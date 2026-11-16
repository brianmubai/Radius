import type {
  Booking,
  BookingStatus,
  Dispute,
  DisputeStatus,
  Payment,
} from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';
import { PricingService } from '../pricing/pricing.service.ts';
import { StripeEscrowService } from '../payments/stripe-escrow.service.ts';
import { BookingStateMachine, type TransitionContext } from './state-machine.ts';
import { SocketHub } from '../realtime/socket.hub.ts';

export class BookingService {
  private pricingService: PricingService;

  constructor(pricingService?: PricingService) {
    this.pricingService = pricingService || new PricingService();
  }

  /**
   * Creates an instant booking, calculates platform fees via the pricing module
   * with automatic subscription overrides, and places funds in escrow hold.
   */
  public createInstantBooking(params: {
    jobRequestId: string;
    providerId: string;
    requesterId: string;
    agreedAmount: number;
    currency?: string;
    scheduledAt?: string;
    isUrgent?: boolean;
    isUrgentEligible?: boolean;
  }): { booking: Booking; payment: Payment } {
    const {
      jobRequestId,
      providerId,
      requesterId,
      agreedAmount,
      currency = 'USD',
      scheduledAt,
      isUrgent = false,
      isUrgentEligible = false,
    } = params;

    const provider = db.providerProfiles.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const requester = db.users.get(requesterId);
    const requesterSub = db.subscriptions.get(requesterId);
    const providerSub = db.subscriptions.get(provider.userId);

    // 1. Calculate fees using subscription overrides automatically
    const feeResult = this.pricingService.calculateFees({
      agreedAmount,
      currency,
      isUrgent,
      isUrgentEligible,
      requesterSubscription: requester?.subscriptionPlan || requesterSub?.plan,
      monthlyBookingsUsed: requesterSub?.monthlyBookingsUsed || requester?.monthlyBookingsUsed || 0,
      providerSubscription: provider.subscriptionPlan || providerSub?.plan,
    });

    // If Radius Plus waiver applied, increment monthly booking counter
    if (feeResult.isFeeWaivedByRadiusPlus && requesterSub) {
      requesterSub.monthlyBookingsUsed = (requesterSub.monthlyBookingsUsed || 0) + 1;
      requesterSub.updatedAt = new Date().toISOString();
      db.subscriptions.set(requesterId, requesterSub);
    }

    const bookingId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 2. Authorize and hold customer funds in escrow
    const payment = StripeEscrowService.holdFunds({
      bookingId,
      requesterId,
      agreedAmount,
      requesterFee: feeResult.totalRequesterFee,
      providerCommission: feeResult.providerCommissionAmount,
      currency,
    });

    // 3. Create Booking
    const booking: Booking = {
      id: bookingId,
      jobRequestId,
      providerId,
      requesterId,
      agreedAmount,
      currency: currency.toUpperCase(),
      status: 'BOOKED',
      scheduledAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payment,
    };

    db.bookings.set(booking.id, booking);

    const job = db.jobRequests.get(jobRequestId);
    if (job) {
      job.status = 'BOOKED';
      db.jobRequests.set(job.id, job);
    }

    db.logAudit('BOOKING_CREATED', 'BOOKING', booking.id, requesterId, {
      providerId,
      agreedAmount,
      grossCharged: feeResult.grossChargedToRequester,
      requesterFee: feeResult.totalRequesterFee,
      providerCommission: feeResult.providerCommissionAmount,
      isFeeWaivedByRadiusPlus: feeResult.isFeeWaivedByRadiusPlus,
    });

    SocketHub.broadcastBookingStatusChange(booking.id, 'BOOKED');

    return { booking, payment };
  }

  public transitionBooking(
    bookingId: string,
    targetStatus: BookingStatus,
    context: TransitionContext
  ): Booking {
    const booking = db.bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    const result = BookingStateMachine.transition(
      booking.status,
      targetStatus,
      context
    );

    booking.status = result.newStatus;
    booking.updatedAt = new Date().toISOString();

    if (targetStatus === 'IN_PROGRESS') {
      // In progress
    } else if (targetStatus === 'COMPLETED') {
      booking.completedAt = new Date().toISOString();
    } else if (targetStatus === 'PAID_OUT') {
      booking.confirmedAt = new Date().toISOString();
      const payment = this.getBookingPayment(booking.id);
      if (payment && payment.status !== 'RELEASED') {
        StripeEscrowService.releaseFunds(payment.id, context.actorId);
        booking.payment = db.payments.get(payment.id);
      }
    } else if (targetStatus === 'CANCELLED') {
      booking.cancelledAt = new Date().toISOString();
      booking.cancelledBy = context.actorId;
      booking.cancellationReason = context.reason;

      const payment = this.getBookingPayment(booking.id);
      if (payment && (payment.status === 'HELD' || payment.status === 'DISPUTED')) {
        StripeEscrowService.refundFunds(
          payment.id,
          context.actorId,
          context.reason || 'Booking cancelled',
          result.cancellationFeeRetained
        );
        booking.payment = db.payments.get(payment.id);
      }
    }

    db.bookings.set(booking.id, booking);

    db.logAudit('BOOKING_STATUS_CHANGED', 'BOOKING', booking.id, context.actorId, {
      from: result.previousStatus,
      to: result.newStatus,
      reason: context.reason,
    });

    SocketHub.broadcastBookingStatusChange(booking.id, targetStatus);

    return booking;
  }

  public openDispute(params: {
    bookingId: string;
    openedBy: string;
    reason: string;
  }): Dispute {
    const { bookingId, openedBy, reason } = params;
    const booking = db.bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    this.transitionBooking(bookingId, 'DISPUTED', {
      actorId: openedBy,
      actorRole: openedBy === booking.requesterId ? 'REQUESTER' : 'PROVIDER',
      reason,
    });

    const payment = this.getBookingPayment(bookingId);
    if (payment) {
      StripeEscrowService.flagDisputed(payment.id, openedBy, reason);
    }

    const slaDueAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const dispute: Dispute = {
      id: `disp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookingId,
      openedBy,
      reason,
      evidence: [],
      status: 'OPEN',
      slaDueAt,
      isSlaBreached: false,
      createdAt: new Date().toISOString(),
    };

    db.disputes.set(dispute.id, dispute);

    db.logAudit('DISPUTE_OPENED', 'DISPUTE', dispute.id, openedBy, {
      bookingId,
      reason,
    });

    return dispute;
  }

  public resolveDispute(params: {
    disputeId: string;
    adminId: string;
    resolution: 'RESOLVED_RELEASED' | 'RESOLVED_REFUNDED';
    notes: string;
  }): Dispute {
    const { disputeId, adminId, resolution, notes } = params;
    const dispute = db.disputes.get(disputeId);
    if (!dispute) {
      throw new Error(`Dispute ${disputeId} not found`);
    }

    if (dispute.status !== 'OPEN') {
      throw new Error(`Dispute ${disputeId} is already resolved`);
    }

    const booking = db.bookings.get(dispute.bookingId);
    if (!booking) {
      throw new Error(`Booking ${dispute.bookingId} not found`);
    }

    dispute.status = resolution;
    dispute.resolution = notes;
    dispute.resolvedAt = new Date().toISOString();
    dispute.resolvedBy = adminId;
    db.disputes.set(dispute.id, dispute);

    if (resolution === 'RESOLVED_RELEASED') {
      this.transitionBooking(booking.id, 'PAID_OUT', {
        actorId: adminId,
        actorRole: 'ADMIN',
        reason: `Dispute resolved in favor of provider: ${notes}`,
      });
    } else {
      this.transitionBooking(booking.id, 'CANCELLED', {
        actorId: adminId,
        actorRole: 'ADMIN',
        reason: `Dispute resolved in favor of requester: ${notes}`,
      });
    }

    db.logAudit('DISPUTE_RESOLVED', 'DISPUTE', dispute.id, adminId, {
      resolution,
      notes,
    });

    return dispute;
  }

  public processAutoConfirmations(cutoffHours: number = 72): Booking[] {
    const cutoffTime = new Date(Date.now() - cutoffHours * 60 * 60 * 1000).toISOString();
    const updatedBookings: Booking[] = [];

    for (const booking of db.bookings.values()) {
      if (
        booking.status === 'COMPLETED' &&
        booking.completedAt &&
        booking.completedAt <= cutoffTime
      ) {
        const updated = this.transitionBooking(booking.id, 'PAID_OUT', {
          actorId: 'system-auto-confirm',
          actorRole: 'SYSTEM',
          reason: `Auto-confirmed after ${cutoffHours} hours without dispute`,
        });
        updatedBookings.push(updated);
      }
    }

    return updatedBookings;
  }

  public getBookingPayment(bookingId: string): Payment | undefined {
    for (const p of db.payments.values()) {
      if (p.bookingId === bookingId) {
        return p;
      }
    }
    return undefined;
  }
}

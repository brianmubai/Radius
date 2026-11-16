import type {
  Dispute,
  DisputeEvidence,
  DisputeReason,
  DisputeStatus,
} from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';
import { StripeEscrowService } from '../payments/stripe-escrow.service.ts';
import { BookingStateMachine } from '../bookings/state-machine.ts';

export class DisputeService {
  private static readonly SLA_HOURS = 48; // 48-hour resolution SLA

  /**
   * Opens a structured dispute with photographic/document evidence.
   */
  public static openDispute(params: {
    bookingId: string;
    openedBy: string;
    reason: DisputeReason | string;
    evidence?: Array<{ fileKey: string; fileUrl: string; description?: string }>;
  }): Dispute {
    const { bookingId, openedBy, reason, evidence = [] } = params;

    const booking = db.bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Role check
    const isRequester = booking.requesterId === openedBy;
    const provider = db.providerProfiles.get(booking.providerId);
    const isProvider = provider && provider.userId === openedBy;

    if (!isRequester && !isProvider) {
      throw new Error('Only the requester or provider can open a dispute');
    }

    // State machine check & transition
    BookingStateMachine.transition(booking.status, 'DISPUTED', {
      actorId: openedBy,
      actorRole: isRequester ? 'REQUESTER' : 'PROVIDER',
      reason: String(reason),
    });

    booking.status = 'DISPUTED';
    booking.updatedAt = new Date().toISOString();
    db.bookings.set(booking.id, booking);

    // Freeze payment funds
    const payment = Array.from(db.payments.values()).find((p) => p.bookingId === bookingId);
    if (payment) {
      StripeEscrowService.flagDisputed(payment.id, openedBy, String(reason));
    }

    const slaDueAt = new Date(Date.now() + this.SLA_HOURS * 60 * 60 * 1000).toISOString();

    const formattedEvidence: DisputeEvidence[] = evidence.map((e, idx) => ({
      id: `ev-${Date.now()}-${idx}`,
      uploaderId: openedBy,
      fileKey: e.fileKey,
      fileUrl: e.fileUrl,
      description: e.description,
      createdAt: new Date().toISOString(),
    }));

    const dispute: Dispute = {
      id: `disp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookingId,
      openedBy,
      reason,
      evidence: formattedEvidence,
      status: 'OPEN',
      slaDueAt,
      isSlaBreached: false,
      createdAt: new Date().toISOString(),
    };

    db.disputes.set(dispute.id, dispute);

    db.logAudit('DISPUTE_OPENED', 'DISPUTE', dispute.id, openedBy, {
      bookingId,
      reason,
      slaDueAt,
      evidenceCount: formattedEvidence.length,
    });

    return dispute;
  }

  /**
   * Adds photographic or documentary evidence to an existing dispute.
   */
  public static addEvidence(params: {
    disputeId: string;
    uploaderId: string;
    fileKey: string;
    fileUrl: string;
    description?: string;
  }): DisputeEvidence {
    const { disputeId, uploaderId, fileKey, fileUrl, description } = params;

    const dispute = db.disputes.get(disputeId);
    if (!dispute) {
      throw new Error(`Dispute ${disputeId} not found`);
    }

    if (dispute.status !== 'OPEN') {
      throw new Error('Cannot attach evidence to a closed dispute');
    }

    const evidenceItem: DisputeEvidence = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      uploaderId,
      fileKey,
      fileUrl,
      description,
      createdAt: new Date().toISOString(),
    };

    dispute.evidence.push(evidenceItem);
    db.disputes.set(dispute.id, dispute);

    db.logAudit('DISPUTE_EVIDENCE_ADDED', 'DISPUTE', dispute.id, uploaderId, {
      evidenceId: evidenceItem.id,
      fileKey,
    });

    return evidenceItem;
  }

  /**
   * Admin resolves a dispute with payout or refund.
   */
  public static resolveDispute(params: {
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

    const payment = Array.from(db.payments.values()).find((p) => p.bookingId === booking.id);

    dispute.status = resolution;
    dispute.resolution = notes;
    dispute.resolvedAt = new Date().toISOString();
    dispute.resolvedBy = adminId;
    db.disputes.set(dispute.id, dispute);

    if (resolution === 'RESOLVED_RELEASED') {
      booking.status = 'PAID_OUT';
      booking.confirmedAt = new Date().toISOString();
      if (payment) {
        StripeEscrowService.releaseFunds(payment.id, adminId);
      }
    } else {
      booking.status = 'CANCELLED';
      booking.cancelledAt = new Date().toISOString();
      booking.cancelledBy = adminId;
      booking.cancellationReason = `Dispute resolved in customer favor: ${notes}`;
      if (payment) {
        StripeEscrowService.refundFunds(payment.id, adminId, notes, false);
      }
    }

    db.bookings.set(booking.id, booking);

    db.logAudit('DISPUTE_RESOLVED', 'DISPUTE', dispute.id, adminId, {
      resolution,
      notes,
    });

    return dispute;
  }

  /**
   * Returns disputes with live SLA computation (time remaining or breached status).
   */
  public static getDisputesWithSla(): Array<Dispute & { hoursRemaining: number }> {
    const now = Date.now();
    const result: Array<Dispute & { hoursRemaining: number }> = [];

    for (const d of db.disputes.values()) {
      const due = new Date(d.slaDueAt).getTime();
      const diffHours = (due - now) / (1000 * 60 * 60);
      const isBreached = d.status === 'OPEN' && diffHours < 0;
      d.isSlaBreached = isBreached;

      result.push({
        ...d,
        hoursRemaining: Math.round(diffHours * 10) / 10,
      });
    }

    return result.sort((a, b) => new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime());
  }
}

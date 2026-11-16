import type { Payment, PaymentStatus } from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';

export interface EscrowHoldParams {
  bookingId: string;
  requesterId: string;
  agreedAmount: number;
  requesterFee: number;
  providerCommission: number;
  currency: string;
}

export class StripeEscrowService {
  public static holdFunds(params: EscrowHoldParams): Payment {
    const {
      bookingId,
      requesterId,
      agreedAmount,
      requesterFee,
      providerCommission,
      currency,
    } = params;

    const grossAmount = agreedAmount + requesterFee;
    const providerPayoutAmount = Math.max(0, agreedAmount - providerCommission);

    const stripePaymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const payment: Payment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookingId,
      stripePaymentIntentId,
      requesterFee,
      providerCommission,
      grossAmount,
      providerPayoutAmount,
      currency: currency.toUpperCase(),
      status: 'HELD',
      heldAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    db.payments.set(payment.id, payment);

    db.logAudit('PAYMENT_HELD', 'PAYMENT', payment.id, requesterId, {
      bookingId,
      grossAmount,
      requesterFee,
      providerCommission,
      providerPayoutAmount,
      stripePaymentIntentId,
    });

    return payment;
  }

  public static releaseFunds(paymentId: string, actorId: string): Payment {
    const payment = db.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    if (payment.status !== 'HELD' && payment.status !== 'DISPUTED') {
      throw new Error(
        `Cannot release payment with status '${payment.status}'. Must be HELD or DISPUTED.`
      );
    }

    const stripeTransferId = `tr_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    payment.status = 'RELEASED';
    payment.stripeTransferId = stripeTransferId;
    payment.releasedAt = new Date().toISOString();

    db.payments.set(payment.id, payment);

    db.logAudit('PAYMENT_RELEASED', 'PAYMENT', payment.id, actorId, {
      stripeTransferId,
      providerPayoutAmount: payment.providerPayoutAmount,
      platformRevenue: payment.requesterFee + payment.providerCommission,
    });

    return payment;
  }

  public static refundFunds(
    paymentId: string,
    actorId: string,
    reason: string,
    retainBookingFee: boolean = false
  ): Payment {
    const payment = db.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    if (payment.status !== 'HELD' && payment.status !== 'DISPUTED') {
      throw new Error(
        `Cannot refund payment with status '${payment.status}'. Must be HELD or DISPUTED.`
      );
    }

    const refundAmount = retainBookingFee
      ? payment.grossAmount - payment.requesterFee
      : payment.grossAmount;

    payment.status = 'REFUNDED';
    payment.refundedAt = new Date().toISOString();

    db.payments.set(payment.id, payment);

    db.logAudit('PAYMENT_REFUNDED', 'PAYMENT', payment.id, actorId, {
      refundAmount,
      retainedBookingFee: retainBookingFee ? payment.requesterFee : 0,
      reason,
    });

    return payment;
  }

  public static flagDisputed(paymentId: string, actorId: string, reason: string): Payment {
    const payment = db.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    payment.status = 'DISPUTED';
    db.payments.set(payment.id, payment);

    db.logAudit('PAYMENT_DISPUTED', 'PAYMENT', payment.id, actorId, { reason });
    return payment;
  }
}

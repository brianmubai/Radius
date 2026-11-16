import type { BookingStatus, PaymentStatus } from '../../../../types/src/index.ts';

export class InvalidStateTransitionError extends Error {
  public readonly currentStatus: BookingStatus;
  public readonly targetStatus: BookingStatus;

  constructor(
    currentStatus: BookingStatus,
    targetStatus: BookingStatus,
    message?: string
  ) {
    super(
      message ||
        `Invalid booking transition from '${currentStatus}' to '${targetStatus}'.`
    );
    this.name = 'InvalidStateTransitionError';
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
  }
}

export interface TransitionContext {
  actorId: string;
  actorRole: 'REQUESTER' | 'PROVIDER' | 'ADMIN' | 'SYSTEM';
  reason?: string;
  metadata?: Record<string, any>;
}

export interface TransitionResult {
  previousStatus: BookingStatus;
  newStatus: BookingStatus;
  expectedPaymentStatus?: PaymentStatus;
  cancellationRefundRequired?: boolean;
  cancellationFeeRetained?: boolean;
}

export class BookingStateMachine {
  private static readonly VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    REQUESTED: ['QUOTED', 'BOOKED', 'CANCELLED'],
    QUOTED: ['BOOKED', 'CANCELLED'],
    BOOKED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'DISPUTED', 'CANCELLED'],
    COMPLETED: ['PAID_OUT', 'DISPUTED'],
    DISPUTED: ['PAID_OUT', 'CANCELLED', 'COMPLETED'],
    CANCELLED: [],
    PAID_OUT: [],
  };

  public static canTransition(from: BookingStatus, to: BookingStatus): boolean {
    const allowed = this.VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  public static transition(
    currentStatus: BookingStatus,
    targetStatus: BookingStatus,
    context: TransitionContext
  ): TransitionResult {
    if (!this.canTransition(currentStatus, targetStatus)) {
      throw new InvalidStateTransitionError(currentStatus, targetStatus);
    }

    const { actorRole } = context;

    switch (targetStatus) {
      case 'IN_PROGRESS':
        if (actorRole !== 'PROVIDER' && actorRole !== 'ADMIN') {
          throw new InvalidStateTransitionError(
            currentStatus,
            targetStatus,
            'Only the provider or an administrator can mark a job IN_PROGRESS.'
          );
        }
        break;

      case 'COMPLETED':
        if (currentStatus === 'IN_PROGRESS') {
          if (actorRole !== 'PROVIDER' && actorRole !== 'ADMIN') {
            throw new InvalidStateTransitionError(
              currentStatus,
              targetStatus,
              'Only the provider can mark a job as COMPLETED.'
            );
          }
        }
        break;

      case 'PAID_OUT':
        if (
          actorRole !== 'REQUESTER' &&
          actorRole !== 'ADMIN' &&
          actorRole !== 'SYSTEM'
        ) {
          throw new InvalidStateTransitionError(
            currentStatus,
            targetStatus,
            'Only requester confirmation, system auto-confirm, or admin dispute resolution can transition to PAID_OUT.'
          );
        }
        break;

      case 'DISPUTED':
        if (currentStatus !== 'IN_PROGRESS' && currentStatus !== 'COMPLETED') {
          throw new InvalidStateTransitionError(
            currentStatus,
            targetStatus,
            'Disputes can only be opened when job is IN_PROGRESS or COMPLETED prior to payout.'
          );
        }
        break;

      case 'CANCELLED':
        break;
    }

    let expectedPaymentStatus: PaymentStatus | undefined;
    let cancellationRefundRequired = false;
    let cancellationFeeRetained = false;

    switch (targetStatus) {
      case 'BOOKED':
        expectedPaymentStatus = 'HELD';
        break;
      case 'IN_PROGRESS':
      case 'COMPLETED':
        expectedPaymentStatus = 'HELD';
        break;
      case 'PAID_OUT':
        expectedPaymentStatus = 'RELEASED';
        break;
      case 'DISPUTED':
        expectedPaymentStatus = 'DISPUTED';
        break;
      case 'CANCELLED':
        expectedPaymentStatus = 'REFUNDED';
        if (currentStatus === 'BOOKED') {
          if (actorRole === 'PROVIDER' || actorRole === 'ADMIN' || actorRole === 'SYSTEM') {
            cancellationRefundRequired = true;
            cancellationFeeRetained = false;
          } else {
            cancellationRefundRequired = true;
            cancellationFeeRetained = true;
          }
        } else if (currentStatus === 'REQUESTED' || currentStatus === 'QUOTED') {
          cancellationRefundRequired = false;
        }
        break;
    }

    return {
      previousStatus: currentStatus,
      newStatus: targetStatus,
      expectedPaymentStatus,
      cancellationRefundRequired,
      cancellationFeeRetained,
    };
  }
}

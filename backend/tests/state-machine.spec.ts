import { describe, it, expect } from './test-utils.ts';
import {
  BookingStateMachine,
  InvalidStateTransitionError,
} from '../src/modules/bookings/state-machine.ts';

describe('BookingStateMachine — Enforced Lifecycle & Escrow Synchronization', () => {
  it('allows full happy path: REQUESTED -> QUOTED -> BOOKED -> IN_PROGRESS -> COMPLETED -> PAID_OUT', () => {
    // 1. REQUESTED -> QUOTED
    let res = BookingStateMachine.transition('REQUESTED', 'QUOTED', {
      actorId: 'prov-1',
      actorRole: 'PROVIDER',
    });
    expect(res.newStatus).toBe('QUOTED');

    // 2. QUOTED -> BOOKED
    res = BookingStateMachine.transition('QUOTED', 'BOOKED', {
      actorId: 'req-1',
      actorRole: 'REQUESTER',
    });
    expect(res.newStatus).toBe('BOOKED');
    expect(res.expectedPaymentStatus).toBe('HELD');

    // 3. BOOKED -> IN_PROGRESS
    res = BookingStateMachine.transition('BOOKED', 'IN_PROGRESS', {
      actorId: 'prov-1',
      actorRole: 'PROVIDER',
    });
    expect(res.newStatus).toBe('IN_PROGRESS');

    // 4. IN_PROGRESS -> COMPLETED
    res = BookingStateMachine.transition('IN_PROGRESS', 'COMPLETED', {
      actorId: 'prov-1',
      actorRole: 'PROVIDER',
    });
    expect(res.newStatus).toBe('COMPLETED');
    expect(res.expectedPaymentStatus).toBe('HELD');

    // 5. COMPLETED -> PAID_OUT
    res = BookingStateMachine.transition('COMPLETED', 'PAID_OUT', {
      actorId: 'req-1',
      actorRole: 'REQUESTER',
    });
    expect(res.newStatus).toBe('PAID_OUT');
    expect(res.expectedPaymentStatus).toBe('RELEASED');
  });

  it('allows instant booking shortcut: REQUESTED -> BOOKED', () => {
    const res = BookingStateMachine.transition('REQUESTED', 'BOOKED', {
      actorId: 'req-1',
      actorRole: 'REQUESTER',
    });
    expect(res.newStatus).toBe('BOOKED');
    expect(res.expectedPaymentStatus).toBe('HELD');
  });

  it('rejects illegal transition: REQUESTED -> PAID_OUT', () => {
    expect(() => {
      BookingStateMachine.transition('REQUESTED', 'PAID_OUT', {
        actorId: 'req-1',
        actorRole: 'REQUESTER',
      });
    }).toThrow(InvalidStateTransitionError);
  });

  it('rejects transitions from terminal states (PAID_OUT, CANCELLED)', () => {
    expect(() => {
      BookingStateMachine.transition('PAID_OUT', 'CANCELLED', {
        actorId: 'admin-1',
        actorRole: 'ADMIN',
      });
    }).toThrow(InvalidStateTransitionError);

    expect(() => {
      BookingStateMachine.transition('CANCELLED', 'BOOKED', {
        actorId: 'req-1',
        actorRole: 'REQUESTER',
      });
    }).toThrow(InvalidStateTransitionError);
  });

  it('enforces role guard: only provider can mark IN_PROGRESS and COMPLETED', () => {
    // Requester attempting to start job
    expect(() => {
      BookingStateMachine.transition('BOOKED', 'IN_PROGRESS', {
        actorId: 'req-1',
        actorRole: 'REQUESTER',
      });
    }).toThrow(InvalidStateTransitionError);

    // Requester attempting to mark job COMPLETED
    expect(() => {
      BookingStateMachine.transition('IN_PROGRESS', 'COMPLETED', {
        actorId: 'req-1',
        actorRole: 'REQUESTER',
      });
    }).toThrow(InvalidStateTransitionError);
  });

  it('enforces role guard: provider CANNOT self-confirm payout', () => {
    expect(() => {
      BookingStateMachine.transition('COMPLETED', 'PAID_OUT', {
        actorId: 'prov-1',
        actorRole: 'PROVIDER',
      });
    }).toThrow(InvalidStateTransitionError);
  });

  it('applies fee retention rule on requester-initiated cancellation in BOOKED', () => {
    const res = BookingStateMachine.transition('BOOKED', 'CANCELLED', {
      actorId: 'req-1',
      actorRole: 'REQUESTER',
      reason: 'Change of plans',
    });

    expect(res.newStatus).toBe('CANCELLED');
    expect(res.cancellationRefundRequired).toBe(true);
    expect(res.cancellationFeeRetained).toBe(true); // Booking fee retained by platform
  });

  it('applies full refund without fee penalty on provider or admin cancellation in BOOKED', () => {
    const res = BookingStateMachine.transition('BOOKED', 'CANCELLED', {
      actorId: 'prov-1',
      actorRole: 'PROVIDER',
      reason: 'Equipment broken',
    });

    expect(res.newStatus).toBe('CANCELLED');
    expect(res.cancellationRefundRequired).toBe(true);
    expect(res.cancellationFeeRetained).toBe(false); // Full refund to requester
  });

  it('supports dispute cycle: COMPLETED -> DISPUTED -> PAID_OUT (or CANCELLED)', () => {
    // Open dispute
    let res = BookingStateMachine.transition('COMPLETED', 'DISPUTED', {
      actorId: 'req-1',
      actorRole: 'REQUESTER',
      reason: 'Job incomplete',
    });
    expect(res.newStatus).toBe('DISPUTED');
    expect(res.expectedPaymentStatus).toBe('DISPUTED');

    // Admin resolves and releases to provider
    res = BookingStateMachine.transition('DISPUTED', 'PAID_OUT', {
      actorId: 'admin-1',
      actorRole: 'ADMIN',
      reason: 'Provider provided photographic proof',
    });
    expect(res.newStatus).toBe('PAID_OUT');
    expect(res.expectedPaymentStatus).toBe('RELEASED');
  });
});

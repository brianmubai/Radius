import type {
  DamageProtectionPlan,
  InsuranceClaim,
} from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';

export class InsuranceService {
  public static readonly DEFAULT_PLAN: DamageProtectionPlan = {
    id: 'plan-radius-shield-10k',
    name: 'Radius Shield Property Protection',
    coverageAmountCents: 1000000, // $10,000 coverage
    feeCents: 999, // $9.99 flat protection fee
    description: 'Guarantees up to $10,000 for accidental property damage incurred during booked services.',
  };

  public static claims: Map<string, InsuranceClaim> = new Map();

  public static reset(): void {
    this.claims.clear();
  }

  public static getPlan(): DamageProtectionPlan {
    return { ...this.DEFAULT_PLAN };
  }

  /**
   * Files a new damage protection claim for a completed or confirmed booking.
   */
  public static fileClaim(params: {
    bookingId: string;
    claimantId: string;
    amountRequestedCents: number;
    description: string;
    photos: string[];
  }): InsuranceClaim {
    const { bookingId, claimantId, amountRequestedCents, description, photos } = params;

    const booking = db.bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (booking.requesterId !== claimantId) {
      throw new Error('Only the booking requester can file an insurance claim');
    }

    if (amountRequestedCents <= 0) {
      throw new Error('Claim amount requested must be greater than zero');
    }

    if (amountRequestedCents > this.DEFAULT_PLAN.coverageAmountCents) {
      throw new Error(
        `Claim amount exceeds maximum coverage cap of $${(this.DEFAULT_PLAN.coverageAmountCents / 100).toFixed(2)}`
      );
    }

    const claim: InsuranceClaim = {
      id: `claim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookingId,
      claimantId,
      amountRequestedCents,
      description,
      photos: photos || [],
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
    };

    this.claims.set(claim.id, claim);
    db.insuranceClaims.set(claim.id, claim);

    db.logAudit('INSURANCE_CLAIM_FILED', 'INSURANCE', claim.id, claimantId, {
      bookingId,
      amountRequestedCents,
    });

    return claim;
  }

  /**
   * Reviews and resolves a filed insurance claim (Admin workflow).
   */
  public static reviewClaim(params: {
    claimId: string;
    adminUserId: string;
    status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
    amountApprovedCents?: number;
    resolutionNotes?: string;
  }): InsuranceClaim {
    const { claimId, adminUserId, status, amountApprovedCents, resolutionNotes } = params;

    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    if (status === 'APPROVED' && (!amountApprovedCents || amountApprovedCents <= 0)) {
      throw new Error('Approved claims must specify a valid amountApprovedCents > 0');
    }

    if (status === 'APPROVED' && amountApprovedCents! > claim.amountRequestedCents) {
      throw new Error('Approved amount cannot exceed the requested amount');
    }

    claim.status = status;
    claim.amountApprovedCents = status === 'APPROVED' ? amountApprovedCents : undefined;
    claim.resolutionNotes = resolutionNotes;
    claim.resolvedBy = adminUserId;
    claim.resolvedAt = new Date().toISOString();

    this.claims.set(claim.id, claim);
    db.insuranceClaims.set(claim.id, claim);

    db.logAudit('INSURANCE_CLAIM_REVIEWED', 'INSURANCE', claim.id, adminUserId, {
      status,
      amountApprovedCents: claim.amountApprovedCents,
      resolutionNotes,
    });

    return claim;
  }

  public static getClaim(claimId: string): InsuranceClaim | undefined {
    return this.claims.get(claimId);
  }

  public static listClaims(bookingId?: string): InsuranceClaim[] {
    const all = Array.from(this.claims.values());
    if (bookingId) {
      return all.filter((c) => c.bookingId === bookingId);
    }
    return all;
  }
}

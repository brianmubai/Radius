import { describe, it, expect } from './test-utils.ts';
import { InsuranceService } from '../src/modules/insurance/insurance.service.ts';
import { PricingService } from '../src/modules/pricing/pricing.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { Booking } from '../../../types/src/index.ts';

describe('Insurance & DamageProtection — Booking Protection Fee & Claims Intake', () => {
  InsuranceService.reset();
  db.reset();

  const pricingService = new PricingService();

  const requesterId = 'usr-req-insurance';
  const providerId = 'pro-insured';

  const booking: Booking = {
    id: 'bkg-ins-01',
    jobRequestId: 'job-ins-01',
    providerId,
    requesterId,
    citySlug: 'san-francisco',
    agreedAmount: 50000, // $500.00
    currency: 'USD',
    hasDamageProtection: true,
    damageProtectionFee: 999, // $9.99
    status: 'COMPLETED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.bookings.set(booking.id, booking);

  it('provides active damage protection plan with $10,000 coverage and $9.99 fee', () => {
    const plan = InsuranceService.getPlan();

    expect(plan.id).toBe('plan-radius-shield-10k');
    expect(plan.coverageAmountCents).toBe(1000000); // $10,000
    expect(plan.feeCents).toBe(999); // $9.99
  });

  it('incorporates damage protection fee into fee calculation engine', () => {
    const fees = pricingService.calculateFees({
      agreedAmount: 50000,
      currency: 'USD',
      isUrgent: false,
      isUrgentEligible: false,
      hasDamageProtection: true,
      damageProtectionFeeCents: 999,
      cityTaxRatePercent: 0.085, // 8.5% SF tax
    });

    expect(fees.insuranceFee).toBe(999);
    expect(fees.taxAmount).toBe(4250); // 8.5% of $500 = $42.50
    expect(fees.requesterBookingFee).toBe(2500); // 5% of $500 = $25.00
    // Gross = 50000 + 2500 + 4250 + 999 = 57749 cents ($577.49)
    expect(fees.grossChargedToRequester).toBe(57749);
  });

  it('allows booking requester to file a damage protection claim with evidence photos', () => {
    const claim = InsuranceService.fileClaim({
      bookingId: booking.id,
      claimantId: requesterId,
      amountRequestedCents: 150000, // $1,500 damage
      description: 'Water damage to hardwood floors after pipe soldering accident',
      photos: ['https://s3.amazonaws.com/radius-claims/damage-1.jpg'],
    });

    expect(claim.id).toBeDefined();
    expect(claim.bookingId).toBe(booking.id);
    expect(claim.claimantId).toBe(requesterId);
    expect(claim.amountRequestedCents).toBe(150000);
    expect(claim.status).toBe('SUBMITTED');
    expect(claim.photos.length).toBe(1);
  });

  it('rejects claim if claimant is not the requester or amount exceeds coverage cap', () => {
    // Non-requester
    expect(() => {
      InsuranceService.fileClaim({
        bookingId: booking.id,
        claimantId: 'intruder-id',
        amountRequestedCents: 50000,
        description: 'False claim',
        photos: [],
      });
    }).toThrow('Only the booking requester can file an insurance claim');

    // Exceeding $10,000 cap
    expect(() => {
      InsuranceService.fileClaim({
        bookingId: booking.id,
        claimantId: requesterId,
        amountRequestedCents: 1500000, // $15,000
        description: 'Excessive claim',
        photos: [],
      });
    }).toThrow('Claim amount exceeds maximum coverage cap');
  });

  it('allows administrator to review, adjust, and approve the insurance claim', () => {
    const claims = InsuranceService.listClaims(booking.id);
    expect(claims.length).toBe(1);
    const claim = claims[0];

    // Admin approves with approved payout
    const resolved = InsuranceService.reviewClaim({
      claimId: claim.id,
      adminUserId: 'admin-adjuster-1',
      status: 'APPROVED',
      amountApprovedCents: 140000, // Approved for $1,400 after adjuster assessment
      resolutionNotes: 'Adjuster inspected invoice from flooring contractor; approved $1,400.',
    });

    expect(resolved.status).toBe('APPROVED');
    expect(resolved.amountApprovedCents).toBe(140000);
    expect(resolved.resolvedBy).toBe('admin-adjuster-1');
    expect(resolved.resolvedAt).toBeDefined();
  });
});

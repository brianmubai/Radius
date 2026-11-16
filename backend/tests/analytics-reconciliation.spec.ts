import { describe, it, expect } from './test-utils.ts';
import { AnalyticsService } from '../src/modules/analytics/analytics.service.ts';
import { PromotionsService } from '../src/modules/promotions/promotions.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { Booking, Payment } from '../../../types/src/index.ts';

describe('Analytics & FinancialReconciliation — Funnels, Liquidity & Cent-to-Cent Audit', () => {
  db.reset();
  PromotionsService.reset();

  it('computes marketplace conversion funnel metrics from requests to completions', () => {
    // Seed requests
    db.jobRequests.set('req-1', {
      id: 'req-1',
      requesterId: 'u-1',
      categoryId: 'plumbing',
      description: 'Job 1',
      photos: [],
      location: { latitude: 37.77, longitude: -122.41 },
      exactAddress: 'Addr 1',
      isUrgent: false,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    });

    db.jobRequests.set('req-2', {
      id: 'req-2',
      requesterId: 'u-1', // Repeat user
      categoryId: 'electrical',
      description: 'Job 2',
      photos: [],
      location: { latitude: 37.77, longitude: -122.41 },
      exactAddress: 'Addr 2',
      isUrgent: false,
      status: 'BOOKED',
      createdAt: new Date().toISOString(),
    });

    db.jobRequests.set('req-3', {
      id: 'req-3',
      requesterId: 'u-2',
      categoryId: 'locksmith',
      description: 'Job 3',
      photos: [],
      location: { latitude: 37.77, longitude: -122.41 },
      exactAddress: 'Addr 3',
      isUrgent: true,
      status: 'REQUESTED', // Unmatched
      createdAt: new Date().toISOString(),
    });

    // Seed bookings
    db.bookings.set('bkg-1', {
      id: 'bkg-1',
      jobRequestId: 'req-1',
      providerId: 'p-1',
      requesterId: 'u-1',
      citySlug: 'san-francisco',
      agreedAmount: 25000,
      currency: 'USD',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.bookings.set('bkg-2', {
      id: 'bkg-2',
      jobRequestId: 'req-2',
      providerId: 'p-2',
      requesterId: 'u-1', // Same user second booking = repeat
      citySlug: 'san-francisco',
      agreedAmount: 18000,
      currency: 'USD',
      status: 'BOOKED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const funnel = AnalyticsService.getFunnelMetrics();

    expect(funnel.requests).toBe(3);
    expect(funnel.matches).toBe(2);
    expect(funnel.bookings).toBe(2);
    expect(funnel.completions).toBe(1);
    expect(funnel.repeatBookings).toBe(1);
    expect(funnel.matchRatePercent).toBe(66.7);
    expect(funnel.bookingConversionPercent).toBe(66.7);
    expect(funnel.completionRatePercent).toBe(50.0);
  });

  it('reconciles marketplace financials to the exact cent across GMV, commissions, fees, taxes and ads', () => {
    // Acceptance criterion: "Analytics dashboards reconcile with payment records to the cent."
    db.payments.clear();
    PromotionsService.reset();

    // Booking 1: Standard job with 8.5% tax, 5% fee, 12% commission, $9.99 damage protection
    // Agreed: $200.00 (20000 cents)
    // Requester fee: $10.00 (1000 cents)
    // City tax: $17.00 (1700 cents)
    // Insurance: $9.99 (999 cents)
    // Gross: 20000 + 1000 + 1700 + 999 = 23699 cents
    // Commission: 12% of 20000 = 2400 cents
    // Provider payout: 20000 - 2400 = 17600 cents
    const bkg1: Booking = {
      id: 'bkg-rec-1',
      jobRequestId: 'req-rec-1',
      providerId: 'p-rec-1',
      requesterId: 'u-rec-1',
      citySlug: 'san-francisco',
      agreedAmount: 20000,
      currency: 'USD',
      status: 'PAID_OUT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const pay1: Payment = {
      id: 'pay-rec-1',
      bookingId: bkg1.id,
      requesterFee: 1000,
      providerCommission: 2400,
      taxAmount: 1700,
      insuranceFee: 999,
      grossAmount: 23699,
      providerPayoutAmount: 17600,
      currency: 'USD',
      status: 'RELEASED',
      createdAt: new Date().toISOString(),
    };

    // Booking 2: Pro Plus pro (8% commission), Radius Plus requester (waived fee = $0), 8.25% Austin tax
    // Agreed: $350.00 (35000 cents)
    // Requester fee: $0
    // City tax: 8.25% of 35000 = 2888 cents
    // Insurance: $0
    // Gross: 35000 + 0 + 2888 + 0 = 37888 cents
    // Commission: 8% of 35000 = 2800 cents
    // Provider payout: 35000 - 2800 = 32200 cents
    const bkg2: Booking = {
      id: 'bkg-rec-2',
      jobRequestId: 'req-rec-2',
      providerId: 'p-rec-2',
      requesterId: 'u-rec-2',
      citySlug: 'austin',
      agreedAmount: 35000,
      currency: 'USD',
      status: 'PAID_OUT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const pay2: Payment = {
      id: 'pay-rec-2',
      bookingId: bkg2.id,
      requesterFee: 0,
      providerCommission: 2800,
      taxAmount: 2888,
      insuranceFee: 0,
      grossAmount: 37888,
      providerPayoutAmount: 32200,
      currency: 'USD',
      status: 'RELEASED',
      createdAt: new Date().toISOString(),
    };

    // Booking 3: Urgent dispatch job in Toronto (13% tax, flat $25 CAD urgent fee, 12% comm)
    // Agreed: $150.00 (15000 cents)
    // Requester fee: 5% ($7.50) + $25.00 urgent = $32.50 (3250 cents)
    // City tax: 13% of 15000 = 1950 cents
    // Insurance: $9.99 (999 cents)
    // Gross: 15000 + 3250 + 1950 + 999 = 21199 cents
    // Commission: 12% of 15000 = 1800 cents
    // Provider payout: 15000 - 1800 = 13200 cents
    const bkg3: Booking = {
      id: 'bkg-rec-3',
      jobRequestId: 'req-rec-3',
      providerId: 'p-rec-3',
      requesterId: 'u-rec-3',
      citySlug: 'toronto',
      agreedAmount: 15000,
      currency: 'CAD',
      status: 'PAID_OUT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const pay3: Payment = {
      id: 'pay-rec-3',
      bookingId: bkg3.id,
      requesterFee: 3250,
      providerCommission: 1800,
      taxAmount: 1950,
      insuranceFee: 999,
      grossAmount: 21199,
      providerPayoutAmount: 13200,
      currency: 'CAD',
      status: 'RELEASED',
      createdAt: new Date().toISOString(),
    };

    db.bookings.set(bkg1.id, bkg1);
    db.payments.set(pay1.id, pay1);
    db.bookings.set(bkg2.id, bkg2);
    db.payments.set(pay2.id, pay2);
    db.bookings.set(bkg3.id, bkg3);
    db.payments.set(pay3.id, pay3);

    // Promoted Ads Billing: 3 clicks billed to providers
    // Click 1: 150 cents ($1.50)
    // Click 2: 200 cents ($2.00)
    // Click 3: 250 cents ($2.50)
    // Total Ad Spend = 600 cents ($6.00)
    PromotionsService.billingRecords.push(
      { id: 'ad-b-1', campaignId: 'c-1', providerId: 'p-1', type: 'CLICK', amountCents: 150, timestamp: new Date().toISOString() },
      { id: 'ad-b-2', campaignId: 'c-2', providerId: 'p-2', type: 'CLICK', amountCents: 200, timestamp: new Date().toISOString() },
      { id: 'ad-b-3', campaignId: 'c-3', providerId: 'p-3', type: 'CLICK', amountCents: 250, timestamp: new Date().toISOString() }
    );

    const rec = AnalyticsService.reconcileFinancials();

    // Verify mathematical reconciliation
    expect(rec.isReconciled).toBe(true);

    // Cent-by-cent assertions:
    // Total Agreed Services: 20000 + 35000 + 15000 = 70000 cents ($700.00)
    expect(rec.agreedServicesCents).toBe(70000);

    // Total Requester Fees: 1000 + 0 + 3250 = 4250 cents ($42.50)
    expect(rec.requesterFeesCents).toBe(4250);

    // Total Tax: 1700 + 2888 + 1950 = 6538 cents ($65.38)
    expect(rec.taxCollectedCents).toBe(6538);

    // Total Insurance: 999 + 0 + 999 = 1998 cents ($19.98)
    expect(rec.insuranceFeesCents).toBe(1998);

    // Gross Volume: 23699 + 37888 + 21199 = 82786 cents ($827.86)
    expect(rec.grossVolumeCents).toBe(82786);
    expect(rec.grossVolumeCents).toBe(
      rec.agreedServicesCents + rec.requesterFeesCents + rec.taxCollectedCents + rec.insuranceFeesCents
    );

    // Provider Commissions: 2400 + 2800 + 1800 = 7000 cents ($70.00)
    expect(rec.providerCommissionsCents).toBe(7000);

    // Provider Payouts: 17600 + 32200 + 13200 = 63000 cents ($630.00)
    expect(rec.providerPayoutsCents).toBe(63000);
    expect(rec.agreedServicesCents).toBe(rec.providerPayoutsCents + rec.providerCommissionsCents);

    // Ad Spend: 600 cents
    expect(rec.promotedAdSpendCents).toBe(600);

    // Net Platform Revenue:
    // 4250 (requester fees) + 7000 (provider commission) + 1998 (insurance) + 600 (ad spend) = 13848 cents ($138.48)
    expect(rec.netPlatformRevenueCents).toBe(13848);

    // Take Rate = 13848 / (82786 - 6538) = 13848 / 76248 = 18.16%
    expect(rec.takeRatePercent).toBe(18.16);
  });
});

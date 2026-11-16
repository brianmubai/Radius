import { describe, it, expect } from './test-utils.ts';
import { PricingService } from '../src/modules/pricing/pricing.service.ts';

describe('PricingModule — Monetization & Fee Engine', () => {
  const pricingService = new PricingService();

  it('calculates standard 5% requester booking fee with rounding', () => {
    const result = pricingService.calculateFees({
      agreedAmount: 10000,
      currency: 'USD',
      isUrgent: false,
      isUrgentEligible: false,
    });

    expect(result.agreedAmount).toBe(10000);
    expect(result.requesterBookingFee).toBe(500);
    expect(result.urgentSurcharge).toBe(0);
    expect(result.totalRequesterFee).toBe(500);
    expect(result.grossChargedToRequester).toBe(10500);
  });

  it('enforces minimum flat booking fee ($2.50 / 250 cents) on low-value jobs', () => {
    const result = pricingService.calculateFees({
      agreedAmount: 2000,
      currency: 'USD',
      isUrgent: false,
      isUrgentEligible: false,
    });

    expect(result.requesterBookingFee).toBe(250);
    expect(result.grossChargedToRequester).toBe(2250);
  });

  it('calculates 12% default provider commission deducted at payout', () => {
    const result = pricingService.calculateFees({
      agreedAmount: 10000,
      currency: 'USD',
      isUrgent: false,
      isUrgentEligible: false,
    });

    expect(result.providerCommissionRate).toBe(0.12);
    expect(result.providerCommissionAmount).toBe(1200);
    expect(result.providerPayoutAmount).toBe(8800);
  });

  it('applies urgent dispatch surcharge when isUrgent is true and category is urgent-eligible', () => {
    const result = pricingService.calculateFees({
      agreedAmount: 15000,
      currency: 'USD',
      isUrgent: true,
      isUrgentEligible: true,
    });

    expect(result.urgentSurcharge).toBe(2000);
    expect(result.requesterBookingFee).toBe(750);
    expect(result.totalRequesterFee).toBe(2750);
    expect(result.grossChargedToRequester).toBe(17750);
  });

  it('does NOT apply urgent surcharge when category is NOT urgent-eligible', () => {
    const result = pricingService.calculateFees({
      agreedAmount: 15000,
      currency: 'USD',
      isUrgent: true,
      isUrgentEligible: false,
    });

    expect(result.urgentSurcharge).toBe(0);
    expect(result.totalRequesterFee).toBe(750);
  });

  it('waives booking fee for Radius Plus subscribers under the monthly cap', () => {
    const result = pricingService.calculateFees({
      agreedAmount: 20000,
      currency: 'USD',
      isUrgent: false,
      isUrgentEligible: false,
      requesterSubscription: 'RADIUS_PLUS',
      monthlyBookingsUsed: 3,
    });

    expect(result.isFeeWaivedByRadiusPlus).toBe(true);
    expect(result.requesterBookingFee).toBe(0);
    expect(result.totalRequesterFee).toBe(0);
    expect(result.grossChargedToRequester).toBe(20000);
  });

  it('charges booking fee for Radius Plus subscribers exceeding monthly cap', () => {
    const result = pricingService.calculateFees({
      agreedAmount: 20000,
      currency: 'USD',
      isUrgent: false,
      isUrgentEligible: false,
      requesterSubscription: 'RADIUS_PLUS',
      monthlyBookingsUsed: 10,
    });

    expect(result.isFeeWaivedByRadiusPlus).toBe(false);
    expect(result.requesterBookingFee).toBe(1000);
  });

  it('discounts provider commission for Pro Plus subscribers (8% instead of 12%)', () => {
    const result = pricingService.calculateFees({
      agreedAmount: 10000,
      currency: 'USD',
      isUrgent: false,
      isUrgentEligible: false,
      providerSubscription: 'PRO_PLUS',
    });

    expect(result.providerCommissionRate).toBe(0.08);
    expect(result.providerCommissionAmount).toBe(800);
    expect(result.providerPayoutAmount).toBe(9200);
  });

  it('verifies exact cent-level precision and rounding rules', () => {
    const result = pricingService.calculateFees({
      agreedAmount: 7777,
      currency: 'USD',
      isUrgent: false,
      isUrgentEligible: false,
    });

    expect(result.requesterBookingFee).toBe(389);
    expect(result.grossChargedToRequester).toBe(8166);
    expect(result.providerCommissionAmount).toBe(933);
    expect(result.providerPayoutAmount).toBe(6844);
    expect(result.grossChargedToRequester - result.requesterBookingFee).toBe(7777);
  });
});

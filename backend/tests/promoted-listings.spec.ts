import { describe, it, expect } from './test-utils.ts';
import { PromotionsService } from '../src/modules/promotions/promotions.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { ProviderProfile } from '../../../types/src/index.ts';

describe('PromotedListings — Sponsored Search Placements & CPC Ledger', () => {
  PromotionsService.reset();
  db.reset();

  const verifiedPro1: ProviderProfile = {
    id: 'pro-verified-promo-1',
    userId: 'usr-promo-1',
    bio: 'Master Electrician with 15 years experience',
    categories: ['electrical'],
    serviceRadiusKm: 20,
    workingHours: {},
    licenses: ['LIC-ELEC-99'],
    verificationStatus: 'VERIFIED',
    ratingAvg: 4.8,
    ratingCount: 40,
    location: { latitude: 37.7749, longitude: -122.4194 },
    approxZone: 'zone-sf-mission',
    createdAt: new Date().toISOString(),
  };

  const verifiedPro2: ProviderProfile = {
    id: 'pro-verified-promo-2',
    userId: 'usr-promo-2',
    bio: 'Residential Electrical Solutions',
    categories: ['electrical'],
    serviceRadiusKm: 20,
    workingHours: {},
    licenses: ['LIC-ELEC-100'],
    verificationStatus: 'VERIFIED',
    ratingAvg: 4.9,
    ratingCount: 65,
    location: { latitude: 37.775, longitude: -122.418 },
    approxZone: 'zone-sf-soma',
    createdAt: new Date().toISOString(),
  };

  const unverifiedPro: ProviderProfile = {
    id: 'pro-unverified-promo',
    userId: 'usr-unverified',
    bio: 'Handyman without license',
    categories: ['electrical'],
    serviceRadiusKm: 20,
    workingHours: {},
    licenses: [],
    verificationStatus: 'PENDING',
    ratingAvg: 3.0,
    ratingCount: 2,
    location: { latitude: 37.7749, longitude: -122.4194 },
    approxZone: 'zone-sf-mission',
    createdAt: new Date().toISOString(),
  };

  db.providerProfiles.set(verifiedPro1.id, verifiedPro1);
  db.providerProfiles.set(verifiedPro2.id, verifiedPro2);
  db.providerProfiles.set(unverifiedPro.id, unverifiedPro);

  it('prohibits unverified providers from creating promoted campaigns', () => {
    expect(() => {
      PromotionsService.createCampaign({
        providerId: unverifiedPro.id,
        citySlug: 'san-francisco',
        categorySlug: 'electrical',
        bidCpcCents: 150,
        dailyBudgetCents: 1500,
      });
    }).toThrow('Only verified professionals can create promoted listings');
  });

  it('allows verified provider to create campaign and injects clearly labeled sponsored placement', () => {
    const campaign = PromotionsService.createCampaign({
      providerId: verifiedPro1.id,
      citySlug: 'san-francisco',
      categorySlug: 'electrical',
      bidCpcCents: 200, // $2.00 CPC
      dailyBudgetCents: 1000, // $10.00 daily budget
    });

    expect(campaign.id).toBeDefined();
    expect(campaign.status).toBe('ACTIVE');

    // Run search in SF
    const rawResults = db.findProvidersInRadius({
      latitude: 37.7749,
      longitude: -122.4194,
      radiusKm: 15,
      categorySlug: 'electrical',
      verifiedOnly: true,
    });

    // In raw results, verifiedPro2 has a higher rating (4.9 vs 4.8), so pro2 is ranked #1 by default
    expect(rawResults[0].provider.id).toBe(verifiedPro2.id);

    // Apply promotions injection
    const resultsWithPromotions = PromotionsService.injectPromotedListings(rawResults, {
      categorySlug: 'electrical',
    });

    // Acceptance criterion: Clearly labeled sponsored placement at the top
    expect(resultsWithPromotions.length).toBe(2);
    expect(resultsWithPromotions[0].provider.id).toBe(verifiedPro1.id);
    expect(resultsWithPromotions[0].isSponsored).toBe(true);
    expect(resultsWithPromotions[1].provider.id).toBe(verifiedPro2.id);
    expect(resultsWithPromotions[1].isSponsored).not.toBe(true);
  });

  it('enforces guardrail: strictly limits sponsored placements to MAX_SPONSORED_SLOTS (1 slot)', () => {
    // Create a competing ad campaign for pro 2
    PromotionsService.createCampaign({
      providerId: verifiedPro2.id,
      citySlug: 'san-francisco',
      categorySlug: 'electrical',
      bidCpcCents: 250,
      dailyBudgetCents: 2500,
    });

    const rawResults = db.findProvidersInRadius({
      latitude: 37.7749,
      longitude: -122.4194,
      radiusKm: 15,
      categorySlug: 'electrical',
      verifiedOnly: true,
    });

    const resultsWithPromotions = PromotionsService.injectPromotedListings(rawResults, {
      categorySlug: 'electrical',
    });

    // Even with 2 active campaigns, exactly 1 sponsored listing is permitted
    const sponsoredCount = resultsWithPromotions.filter((r) => r.isSponsored).length;
    expect(sponsoredCount).toBe(PromotionsService.MAX_SPONSORED_SLOTS);
    expect(sponsoredCount).toBe(1);
  });

  it('does NOT display sponsored listing if provider is outside requested radius or category', () => {
    // Search in Oakland (different coordinates, 5km radius)
    const oaklandResults = db.findProvidersInRadius({
      latitude: 37.8044,
      longitude: -122.2712,
      radiusKm: 5,
      categorySlug: 'electrical',
      verifiedOnly: true,
    });

    const oaklandInjected = PromotionsService.injectPromotedListings(oaklandResults, {
      categorySlug: 'electrical',
    });

    // Pros are in SF (>12km away), so they are outside 5km radius and cannot appear even with active ads
    expect(oaklandInjected.length).toBe(0);
  });

  it('tracks clicks, debits daily budget, creates billing record, and pauses on budget exhaustion', () => {
    const campaign = Array.from(PromotionsService.campaigns.values())[0];
    const initialSpent = campaign.spentTodayCents;
    const bid = campaign.bidCpcCents;

    // 1. Record Click
    const record = PromotionsService.recordClick(campaign.id);
    expect(record.amountCents).toBe(bid);
    expect(record.type).toBe('CLICK');
    expect(campaign.spentTodayCents).toBe(initialSpent + bid);

    // 2. Consume remaining budget
    while (campaign.spentTodayCents < campaign.dailyBudgetCents) {
      PromotionsService.recordClick(campaign.id);
    }

    expect(campaign.status).toBe('BUDGET_EXHAUSTED');

    // 3. Verify billing ledger has recorded transactions
    const billingRecords = PromotionsService.getBillingRecords(campaign.id);
    expect(billingRecords.length).toBeGreaterThan(0);
    const totalBilled = billingRecords.reduce((sum, r) => sum + r.amountCents, 0);
    expect(totalBilled).toBeGreaterThanOrEqual(campaign.dailyBudgetCents);
  });
});

import { describe, it, expect } from './test-utils.ts';
import { CityService } from '../src/modules/cities/city.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { CityConfig, ProviderProfile } from '../../../types/src/index.ts';

describe('MultiCityEngine — Configuration-Driven Regional Expansion', () => {
  it('launches a new city by adding configuration and seeding providers WITHOUT code changes', () => {
    // Acceptance criterion: "A new city can be launched by adding configuration and seeding providers, without code changes."
    const miamiConfig: CityConfig = {
      id: 'city-miami',
      slug: 'miami',
      name: 'Miami, FL',
      country: 'USA',
      currency: 'USD',
      timezone: 'America/New_York',
      defaultLocale: 'en-US',
      center: { latitude: 25.7617, longitude: -80.1918 },
      serviceRadiusKm: 35,
      taxRatePercent: 0.07, // 7% Florida sales tax
      feeOverrides: {
        requesterFeePercent: 0.045, // 4.5% promotional market launch fee
        providerCommissionPercent: 0.10, // 10% launch incentive commission
      },
      enabledCategories: ['plumbing', 'electrical', 'landscaping', 'tree-removal', 'locksmith'],
    };

    // 1. Register new city dynamically via config
    CityService.registerCity(miamiConfig);

    const registered = CityService.getCity('miami');
    expect(registered).toBeDefined();
    expect(registered?.name).toBe('Miami, FL');
    expect(registered?.taxRatePercent).toBe(0.07);

    // 2. Seed a local Miami provider
    const miamiProvider: ProviderProfile = {
      id: 'pro-miami-1',
      userId: 'usr-miami-1',
      bio: 'Licensed Miami HVAC & Plumbing Specialist',
      categories: ['plumbing'],
      serviceRadiusKm: 25,
      workingHours: {},
      licenses: ['FL-CFC142857'],
      verificationStatus: 'VERIFIED',
      ratingAvg: 4.9,
      ratingCount: 32,
      location: { latitude: 25.7781, longitude: -80.1882 }, // Biscayne Blvd, Miami
      approxZone: 'zone-brickell-1',
      createdAt: new Date().toISOString(),
    };
    db.providerProfiles.set(miamiProvider.id, miamiProvider);

    // 3. Search at Downtown Miami coordinates (25.7617, -80.1918)
    const results = db.findProvidersInRadius({
      latitude: 25.7617,
      longitude: -80.1918,
      radiusKm: 10,
      categorySlug: 'plumbing',
      verifiedOnly: true,
    });

    expect(results.length).toBe(1);
    expect(results[0].provider.id).toBe('pro-miami-1');
    expect(results[0].distanceKm).toBeLessThan(5);
  });

  it('resolves city automatically by GPS coordinates and applies city tax rules', () => {
    // Austin Coordinates: 30.2672, -97.7431
    const austinCity = CityService.resolveCityForLocation({
      latitude: 30.268,
      longitude: -97.745,
    });

    expect(austinCity).toBeDefined();
    expect(austinCity?.slug).toBe('austin');
    expect(austinCity?.currency).toBe('USD');
    expect(austinCity?.taxRatePercent).toBe(0.0825); // 8.25% Texas tax
  });

  it('enforces city category gating', () => {
    // Landscaping is not enabled in London config
    const londonConfig = CityService.getCity('london');
    expect(londonConfig).toBeDefined();
    expect(londonConfig?.currency).toBe('GBP');
    expect(CityService.isCategoryEnabled('london', 'plumbing')).toBe(true);
    expect(CityService.isCategoryEnabled('london', 'landscaping')).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from './test-utils.ts';
import { GeospatialService } from '../src/modules/providers/geospatial.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { ProviderProfile } from '../../../types/src/index.ts';

describe('GeospatialService & Spatial PostGIS Search', () => {
  beforeEach(() => {
    db.reset();
  });

  it('calculates geodesic distances accurately using WGS84 ellipsoidal formula', () => {
    // Downtown San Francisco (Union Square: 37.7879, -122.4075)
    // Mission District (Mission & 24th: 37.7522, -122.4184)
    // Distance should be approximately 4.0 km
    const unionSquare = { latitude: 37.7879, longitude: -122.4075 };
    const mission24th = { latitude: 37.7522, longitude: -122.4184 };

    const distance = GeospatialService.calculateDistanceKm(unionSquare, mission24th);
    expect(distance).toBeGreaterThan(3.5);
    expect(distance).toBeLessThan(4.5);
    expect(distance).toBeCloseTo(4.06, 0.2);
  });

  it('filters providers by search radius and sorts by distance ascending', () => {
    const center = { latitude: 37.7749, longitude: -122.4194 }; // SF Center

    // Provider 1: 2 km away (Plumber, Verified)
    const p1: ProviderProfile = {
      id: 'prov-1',
      userId: 'user-p1',
      bio: 'Fast plumbing',
      categories: ['plumbing'],
      serviceRadiusKm: 15,
      workingHours: {},
      licenses: [],
      verificationStatus: 'VERIFIED',
      ratingAvg: 4.8,
      ratingCount: 25,
      location: { latitude: 37.7900, longitude: -122.4100 }, // ~2 km
      approxZone: GeospatialService.computeApproximateZone({ latitude: 37.7900, longitude: -122.4100 }),
    };

    // Provider 2: 7 km away (Plumber, Verified)
    const p2: ProviderProfile = {
      id: 'prov-2',
      userId: 'user-p2',
      bio: 'Expert plumbing',
      categories: ['plumbing'],
      serviceRadiusKm: 20,
      workingHours: {},
      licenses: [],
      verificationStatus: 'VERIFIED',
      ratingAvg: 4.5,
      ratingCount: 10,
      location: { latitude: 37.7100, longitude: -122.4194 }, // ~7.2 km
      approxZone: GeospatialService.computeApproximateZone({ latitude: 37.7100, longitude: -122.4194 }),
    };

    // Provider 3: 18 km away (Plumber, Verified - outside 10 km)
    const p3: ProviderProfile = {
      id: 'prov-3',
      userId: 'user-p3',
      bio: 'Oakland plumbing',
      categories: ['plumbing'],
      serviceRadiusKm: 30,
      workingHours: {},
      licenses: [],
      verificationStatus: 'VERIFIED',
      ratingAvg: 5.0,
      ratingCount: 40,
      location: { latitude: 37.8044, longitude: -122.2712 }, // ~18 km
      approxZone: GeospatialService.computeApproximateZone({ latitude: 37.8044, longitude: -122.2712 }),
    };

    db.providerProfiles.set(p1.id, p1);
    db.providerProfiles.set(p2.id, p2);
    db.providerProfiles.set(p3.id, p3);

    // Search with default 10 km radius
    const results = db.findProvidersInRadius({
      latitude: center.latitude,
      longitude: center.longitude,
      radiusKm: 10,
      categorySlug: 'plumbing',
    });

    expect(results.length).toBe(2);
    expect(results[0].provider.id).toBe('prov-1'); // closest first (~2km)
    expect(results[1].provider.id).toBe('prov-2'); // second (~7km)
    expect(results[0].distanceKm).toBeLessThan(results[1].distanceKm);

    // Expand search to 25 km -> includes provider 3
    const expandedResults = db.findProvidersInRadius({
      latitude: center.latitude,
      longitude: center.longitude,
      radiusKm: 25,
      categorySlug: 'plumbing',
    });
    expect(expandedResults.length).toBe(3);
  });

  it('enforces verified-only filtering by default', () => {
    const center = { latitude: 37.7749, longitude: -122.4194 };

    const unverifiedProvider: ProviderProfile = {
      id: 'prov-unverified',
      userId: 'user-unv',
      bio: 'Pending locksmith',
      categories: ['locksmith'],
      serviceRadiusKm: 15,
      workingHours: {},
      licenses: [],
      verificationStatus: 'PENDING',
      ratingAvg: 0,
      ratingCount: 0,
      location: { latitude: 37.7750, longitude: -122.4190 }, // 50m away
      approxZone: GeospatialService.computeApproximateZone({ latitude: 37.7750, longitude: -122.4190 }),
    };

    db.providerProfiles.set(unverifiedProvider.id, unverifiedProvider);

    const results = db.findProvidersInRadius({
      latitude: center.latitude,
      longitude: center.longitude,
      radiusKm: 10,
      verifiedOnly: true,
    });

    expect(results.length).toBe(0);
  });

  it('masks provider location to ~750m grid centroid prior to booking confirmation', () => {
    const exactLocation = { latitude: 37.774923, longitude: -122.419416 };
    const provider: ProviderProfile = {
      id: 'prov-secret',
      userId: 'user-secret',
      bio: 'Locksmith',
      categories: ['locksmith'],
      serviceRadiusKm: 10,
      workingHours: {},
      licenses: [],
      verificationStatus: 'VERIFIED',
      ratingAvg: 4.9,
      ratingCount: 15,
      location: exactLocation,
      approxZone: GeospatialService.computeApproximateZone(exactLocation),
      user: {
        id: 'user-secret',
        name: 'John Locksmith',
        phone: '+14155551234',
        email: 'john@locksmith.com',
      },
    };

    // 1. Unconfirmed search: coordinates snapped to grid centroid, contact redacted
    const masked = GeospatialService.maskProviderForSearch(provider, false);

    expect(masked.location.latitude).toBe(masked.approxZone.centerLatitude);
    expect(masked.location.longitude).toBe(masked.approxZone.centerLongitude);
    expect(masked.approxZone.radiusMeters).toBe(750);
    // Contact info must be hidden
    expect(masked.user?.phone).toBeUndefined();
    expect(masked.user?.email).toBeUndefined();
    expect(masked.user?.name).toBe('John Locksmith');

    // 2. Confirmed booking: reveals exact coordinates and contact
    const revealed = GeospatialService.maskProviderForSearch(provider, true);
    expect(revealed.location.latitude).toBe(exactLocation.latitude);
    expect(revealed.location.longitude).toBe(exactLocation.longitude);
    expect(revealed.user?.phone).toBe('+14155551234');
    expect(revealed.user?.email).toBe('john@locksmith.com');
  });

  it('builds valid PostGIS ST_DWithin query with GiST parameters', () => {
    const query = GeospatialService.buildPostgisQuery(37.7749, -122.4194, 10000);

    expect(query.sql.includes('ST_DWithin')).toBe(true);
    expect(query.sql.includes('ST_MakePoint')).toBe(true);
    expect(query.sql.includes('ST_Distance')).toBe(true);
    expect(query.params[0]).toBe(-122.4194); // Longitude first in PostGIS ST_MakePoint
    expect(query.params[1]).toBe(37.7749);
    expect(query.params[2]).toBe(10000); // 10,000 meters = 10 km
  });
});

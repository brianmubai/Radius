import { performance } from 'node:perf_hooks';
import type { ProviderProfile } from '../../../../types/src/index.ts';
import { InMemoryDatabase } from '../../db/in-memory-db.ts';
import { GeoCacheService } from '../cache/geo-cache.service.ts';

export interface LoadTestReport {
  targetProviderCount: number;
  queriesExecuted: number;
  totalDurationMs: number;
  qps: number;
  latencies: {
    minMs: number;
    maxMs: number;
    avgMs: number;
    p50Ms: number;
    p90Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  p95Under500ms: boolean;
  cacheStats: {
    hits: number;
    misses: number;
  };
}

export class SpatialLoadTester {
  private db: InMemoryDatabase;
  private cache: GeoCacheService;

  constructor(db?: InMemoryDatabase) {
    this.db = db || new InMemoryDatabase();
    this.cache = new GeoCacheService(30000);
  }

  /**
   * Seeds N providers distributed around key metropolitan anchors.
   */
  public seedProviders(count: number = 10000): void {
    const anchors = [
      { name: 'SF', lat: 37.7749, lon: -122.4194 },
      { name: 'Austin', lat: 30.2672, lon: -97.7431 },
      { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
      { name: 'London', lat: 51.5074, lon: -0.1278 },
    ];

    const categories = ['plumbing', 'electrical', 'carpentry', 'locksmith', 'landscaping', 'mechanics'];

    for (let i = 0; i < count; i++) {
      const anchor = anchors[i % anchors.length];
      // Jitter by up to +/- 0.3 degrees (~30 km radius)
      const lat = anchor.lat + (Math.random() - 0.5) * 0.6;
      const lon = anchor.lon + (Math.random() - 0.5) * 0.6;
      const cat = categories[i % categories.length];
      const isVerified = i % 5 !== 0; // 80% verified
      const ratingAvg = 3.5 + Math.random() * 1.5;

      const provider: ProviderProfile = {
        id: `pro-scale-${i}`,
        userId: `usr-scale-${i}`,
        bio: `Professional ${cat} specialist with extensive local experience`,
        categories: [cat],
        serviceRadiusKm: 25,
        workingHours: {
          timezone: 'America/Los_Angeles',
          schedule: {
            monday: { open: '08:00', close: '18:00' },
            tuesday: { open: '08:00', close: '18:00' },
            wednesday: { open: '08:00', close: '18:00' },
            thursday: { open: '08:00', close: '18:00' },
            friday: { open: '08:00', close: '18:00' },
          },
        },
        licenses: [],
        verificationStatus: isVerified ? 'VERIFIED' : 'PENDING',
        ratingAvg: Math.round(ratingAvg * 10) / 10,
        ratingCount: Math.floor(Math.random() * 50) + 1,
        location: { latitude: lat, longitude: lon },
        approxZone: `zone-${anchor.name.toLowerCase()}-${Math.floor(i % 10)}`,
        subscriptionPlan: i % 20 === 0 ? 'PRO_PLUS' : 'PRO_BASIC',
        isFeatured: i % 20 === 0,
        createdAt: new Date().toISOString(),
      };

      this.db.providerProfiles.set(provider.id, provider);
    }
  }

  /**
   * Runs load test benchmark with N search queries.
   */
  public runBenchmark(queryCount: number = 1000, useCache: boolean = true): LoadTestReport {
    const latencies: number[] = [];
    const queryPoints = [
      { lat: 37.7749, lon: -122.4194 },
      { lat: 30.2672, lon: -97.7431 },
      { lat: 43.6532, lon: -79.3832 },
      { lat: 51.5074, lon: -0.1278 },
    ];

    const categories = ['plumbing', 'electrical', 'carpentry', 'locksmith', undefined];

    const totalStart = performance.now();

    for (let q = 0; q < queryCount; q++) {
      const point = queryPoints[q % queryPoints.length];
      const jitterLat = point.lat + (Math.random() - 0.5) * 0.1;
      const jitterLon = point.lon + (Math.random() - 0.5) * 0.1;
      const categorySlug = categories[q % categories.length];
      const radiusKm = 10 + (q % 20);

      const cacheKey = GeoCacheService.makeKey({
        latitude: jitterLat,
        longitude: jitterLon,
        radiusKm,
        categorySlug,
        verifiedOnly: true,
      });

      const qStart = performance.now();

      if (useCache) {
        const cached = this.cache.get(cacheKey);
        if (!cached) {
          const results = this.db.findProvidersInRadius({
            latitude: jitterLat,
            longitude: jitterLon,
            radiusKm,
            categorySlug,
            verifiedOnly: true,
          });
          this.cache.set(cacheKey, results);
        }
      } else {
        this.db.findProvidersInRadius({
          latitude: jitterLat,
          longitude: jitterLon,
          radiusKm,
          categorySlug,
          verifiedOnly: true,
        });
      }

      const qEnd = performance.now();
      latencies.push(qEnd - qStart);
    }

    const totalEnd = performance.now();
    const totalDurationMs = totalEnd - totalStart;

    latencies.sort((a, b) => a - b);

    const getPercentile = (p: number) => {
      const idx = Math.floor((p / 100) * (latencies.length - 1));
      return Math.round(latencies[idx] * 100) / 100;
    };

    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const avg = Math.round((sum / latencies.length) * 100) / 100;
    const p50 = getPercentile(50);
    const p90 = getPercentile(90);
    const p95 = getPercentile(95);
    const p99 = getPercentile(99);
    const min = Math.round(latencies[0] * 100) / 100;
    const max = Math.round(latencies[latencies.length - 1] * 100) / 100;

    const stats = this.cache.getStats();

    return {
      targetProviderCount: this.db.providerProfiles.size,
      queriesExecuted: queryCount,
      totalDurationMs: Math.round(totalDurationMs * 100) / 100,
      qps: Math.round((queryCount / (totalDurationMs / 1000)) * 10) / 10,
      latencies: {
        minMs: min,
        maxMs: max,
        avgMs: avg,
        p50Ms: p50,
        p90Ms: p90,
        p95Ms: p95,
        p99Ms: p99,
      },
      p95Under500ms: p95 < 500,
      cacheStats: {
        hits: stats.hits,
        misses: stats.misses,
      },
    };
  }
}

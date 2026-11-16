export interface CacheStats {
  hits: number;
  misses: number;
  keysCount: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class GeoCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 60000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Generates a spatial grid key by quantizing latitude and longitude
   * into approximately 750m-1km buckets (0.01 degree ~ 1.11 km).
   */
  public static makeKey(params: {
    latitude: number;
    longitude: number;
    radiusKm: number;
    categorySlug?: string;
    verifiedOnly?: boolean;
    minRating?: number;
  }): string {
    const latBucket = Math.round(params.latitude * 100) / 100;
    const lonBucket = Math.round(params.longitude * 100) / 100;
    const cat = params.categorySlug || 'all';
    const ver = params.verifiedOnly !== false ? '1' : '0';
    const rat = params.minRating || 0;
    return `geo:${latBucket}:${lonBucket}:r${params.radiusKm}:c${cat}:v${ver}:r${rat}`;
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses += 1;
      return null;
    }

    this.hits += 1;
    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  public getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      keysCount: this.cache.size,
    };
  }
}

export const geoCache = new GeoCacheService();

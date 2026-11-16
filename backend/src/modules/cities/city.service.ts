import type { CityConfig, GeoPoint, PricingConfig } from '../../../../types/src/index.ts';
import { CITIES_REGISTRY } from '../../config/cities.config.ts';
import { DEFAULT_PRICING_CONFIG } from '../../config/pricing.config.ts';
import { GeospatialService } from '../providers/geospatial.service.ts';

export class CityService {
  private static dynamicCities: Map<string, CityConfig> = new Map(
    Object.entries(CITIES_REGISTRY)
  );

  public static reset(): void {
    this.dynamicCities = new Map(Object.entries(CITIES_REGISTRY));
  }

  /**
   * Registers a new city dynamically from configuration.
   * Fulfills acceptance criteria: a new city can be launched by adding config and seeding providers, without code changes.
   */
  public static registerCity(config: CityConfig): CityConfig {
    this.dynamicCities.set(config.slug, config);
    return config;
  }

  public static getCity(slug: string): CityConfig | undefined {
    return this.dynamicCities.get(slug);
  }

  public static getAllCities(): CityConfig[] {
    return Array.from(this.dynamicCities.values());
  }

  /**
   * Resolves the matching city based on GPS coordinates.
   */
  public static resolveCityForLocation(point: GeoPoint): CityConfig | undefined {
    let closestCity: CityConfig | undefined;
    let shortestDistance = Infinity;

    for (const city of this.dynamicCities.values()) {
      const distance = GeospatialService.calculateDistanceKm(point, city.center);
      if (distance <= city.serviceRadiusKm && distance < shortestDistance) {
        shortestDistance = distance;
        closestCity = city;
      }
    }

    return closestCity || this.dynamicCities.get('san-francisco');
  }

  /**
   * Returns merged pricing config with city-specific fee overrides and tax rules.
   */
  public static getCityPricingConfig(slug?: string): {
    pricingConfig: PricingConfig;
    taxRatePercent: number;
    currency: string;
  } {
    const city = (slug && this.dynamicCities.get(slug)) || this.dynamicCities.get('san-francisco')!;
    const overrides = city.feeOverrides || {};

    return {
      pricingConfig: {
        ...DEFAULT_PRICING_CONFIG,
        ...overrides,
      },
      taxRatePercent: city.taxRatePercent,
      currency: city.currency,
    };
  }
}


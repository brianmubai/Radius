import type { ApproxZone, GeoPoint, ProviderProfile } from '../../../../types/src/index.ts';

export class GeospatialService {
  private static readonly GRID_RESOLUTION_DEG = 0.007;
  private static readonly EARTH_RADIUS_KM = 6371;

  public static calculateDistanceKm(pointA: GeoPoint, pointB: GeoPoint): number {
    const lat1Rad = (pointA.latitude * Math.PI) / 180;
    const lat2Rad = (pointB.latitude * Math.PI) / 180;
    const deltaLatRad = ((pointB.latitude - pointA.latitude) * Math.PI) / 180;
    const deltaLngRad = ((pointB.longitude - pointA.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLngRad / 2) *
        Math.sin(deltaLngRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = this.EARTH_RADIUS_KM * c;
    return Math.round(distance * 100) / 100;
  }

  public static computeApproximateZone(point: GeoPoint): ApproxZone {
    const centerLatitude =
      Math.round(point.latitude / this.GRID_RESOLUTION_DEG) *
      this.GRID_RESOLUTION_DEG;
    const centerLongitude =
      Math.round(point.longitude / this.GRID_RESOLUTION_DEG) *
      this.GRID_RESOLUTION_DEG;

    return {
      centerLatitude: Math.round(centerLatitude * 10000) / 10000,
      centerLongitude: Math.round(centerLongitude * 10000) / 10000,
      radiusMeters: 750,
      label: 'Approximate Service Area (~750m zone)',
    };
  }

  public static maskProviderForSearch(
    provider: ProviderProfile,
    isConfirmedBooking: boolean = false
  ): ProviderProfile {
    if (isConfirmedBooking) {
      return { ...provider };
    }

    const approxZone =
      provider.approxZone && provider.approxZone.centerLatitude
        ? provider.approxZone
        : this.computeApproximateZone(provider.location);

    const masked: ProviderProfile = {
      ...provider,
      location: {
        latitude: approxZone.centerLatitude,
        longitude: approxZone.centerLongitude,
      },
      approxZone,
    };

    if (masked.user) {
      masked.user = {
        id: masked.user.id,
        name: masked.user.name,
        role: masked.user.role,
        locale: masked.user.locale,
      };
    }

    return masked;
  }

  public static buildPostgisQuery(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ) {
    return {
      sql: `
        SELECT 
          p.*,
          ST_Distance(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
        FROM provider_profiles p
        WHERE ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
          AND p.verification_status = 'VERIFIED'
        ORDER BY distance_meters ASC
      `,
      params: [longitude, latitude, radiusMeters],
    };
  }
}

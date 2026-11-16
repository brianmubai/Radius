import type { CityConfig } from '../../../types/src/index.ts';

export const CITIES_REGISTRY: Record<string, CityConfig> = {
  'san-francisco': {
    id: 'city-sf-01',
    slug: 'san-francisco',
    name: 'San Francisco Bay Area',
    country: 'US',
    currency: 'USD',
    timezone: 'America/Los_Angeles',
    defaultLocale: 'en-US',
    center: { latitude: 37.7749, longitude: -122.4194 },
    serviceRadiusKm: 50,
    taxRatePercent: 0.08625, // 8.625% local sales tax
    feeOverrides: {
      requesterFeePercent: 0.05,
      requesterFeeMinAmount: 250,
      providerCommissionPercent: 0.12,
      urgentSurchargeFlat: 2000,
    },
    enabledCategories: [
      'carpentry',
      'mechanics',
      'tree-removal',
      'landscaping',
      'locksmith',
      'plumbing',
      'electrical',
      'appliance-repair',
    ],
  },
  austin: {
    id: 'city-austin-02',
    slug: 'austin',
    name: 'Austin Metro',
    country: 'US',
    currency: 'USD',
    timezone: 'America/Chicago',
    defaultLocale: 'en-US',
    center: { latitude: 30.2672, longitude: -97.7431 },
    serviceRadiusKm: 45,
    taxRatePercent: 0.0825, // 8.25% Texas sales tax
    feeOverrides: {
      requesterFeePercent: 0.045, // competitive 4.5% introductory fee
      requesterFeeMinAmount: 200,
      providerCommissionPercent: 0.10, // 10% introductory commission
      urgentSurchargeFlat: 1500, // $15.00 urgent flat
    },
    enabledCategories: [
      'carpentry',
      'mechanics',
      'tree-removal',
      'landscaping',
      'locksmith',
      'plumbing',
      'electrical',
      'appliance-repair',
    ],
  },
  toronto: {
    id: 'city-toronto-03',
    slug: 'toronto',
    name: 'Greater Toronto Area',
    country: 'CA',
    currency: 'CAD',
    timezone: 'America/Toronto',
    defaultLocale: 'en-CA',
    center: { latitude: 43.6532, longitude: -79.3832 },
    serviceRadiusKm: 40,
    taxRatePercent: 0.13, // 13% Ontario HST
    feeOverrides: {
      requesterFeePercent: 0.05,
      requesterFeeMinAmount: 300, // $3.00 CAD
      providerCommissionPercent: 0.12,
      urgentSurchargeFlat: 2500, // $25.00 CAD
    },
    enabledCategories: [
      'carpentry',
      'mechanics',
      'landscaping',
      'locksmith',
      'plumbing',
      'electrical',
      'appliance-repair',
    ],
  },
  london: {
    id: 'city-london-04',
    slug: 'london',
    name: 'Greater London',
    country: 'GB',
    currency: 'GBP',
    timezone: 'Europe/London',
    defaultLocale: 'en-GB',
    center: { latitude: 51.5074, longitude: -0.1278 },
    serviceRadiusKm: 35,
    taxRatePercent: 0.20, // 20% UK VAT
    feeOverrides: {
      requesterFeePercent: 0.05,
      requesterFeeMinAmount: 200, // £2.00 GBP
      providerCommissionPercent: 0.12,
      urgentSurchargeFlat: 1800, // £18.00 GBP
    },
    enabledCategories: [
      'carpentry',
      'mechanics',
      'tree-removal',
      'locksmith',
      'plumbing',
      'electrical',
      'appliance-repair',
    ],
  },
};

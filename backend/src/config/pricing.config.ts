import type { PricingConfig } from '../../../types/src/index.ts';

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  requesterFeePercent: parseFloat(process.env.REQUESTER_FEE_PERCENT || '0.05'),
  requesterFeeMinAmount: parseInt(process.env.REQUESTER_FEE_MIN_AMOUNT || '250', 10),
  urgentSurchargeFlat: parseInt(process.env.URGENT_SURCHARGE_FLAT || '2000', 10),
  urgentSurchargePercent: parseFloat(process.env.URGENT_SURCHARGE_PERCENT || '0.10'),
  providerCommissionPercent: parseFloat(process.env.PROVIDER_COMMISSION_PERCENT || '0.12'),
  radiusPlusFreeBookingsPerMonth: parseInt(process.env.RADIUS_PLUS_FREE_BOOKINGS || '10', 10),
  proPlusCommissionDiscountPercent: parseFloat(process.env.PRO_PLUS_COMMISSION_DISCOUNT || '0.04'),
};

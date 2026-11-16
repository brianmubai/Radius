import type {
  CalculateFeeParams,
  FeeCalculationResult,
  PricingConfig,
} from '../../../../types/src/index.ts';
import { DEFAULT_PRICING_CONFIG } from '../../config/pricing.config.ts';

export class PricingService {
  private config: PricingConfig;

  constructor(customConfig?: Partial<PricingConfig>) {
    this.config = {
      ...DEFAULT_PRICING_CONFIG,
      ...customConfig,
    };
  }

  public updateConfig(newConfig: Partial<PricingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }

  public getConfig(): PricingConfig {
    return { ...this.config };
  }

  public calculateFees(params: CalculateFeeParams): FeeCalculationResult {
    const {
      agreedAmount,
      currency,
      isUrgent,
      isUrgentEligible,
      requesterSubscription,
      monthlyBookingsUsed = 0,
      providerSubscription,
      cityTaxRatePercent = 0,
      hasDamageProtection = false,
      damageProtectionFeeCents = 999,
    } = params;

    const activeConfig = {
      ...this.config,
      ...params.config,
    };

    if (agreedAmount < 0) {
      throw new Error('Agreed amount must be non-negative');
    }

    // 1. Calculate Requester Booking Fee
    let isFeeWaivedByRadiusPlus = false;
    let requesterBookingFee = 0;

    if (
      requesterSubscription === 'RADIUS_PLUS' &&
      monthlyBookingsUsed < activeConfig.radiusPlusFreeBookingsPerMonth
    ) {
      isFeeWaivedByRadiusPlus = true;
      requesterBookingFee = 0;
    } else {
      const percentageFee = Math.round(agreedAmount * activeConfig.requesterFeePercent);
      requesterBookingFee = Math.max(activeConfig.requesterFeeMinAmount, percentageFee);
    }

    // 2. Urgent Dispatch Surcharge
    let urgentSurcharge = 0;
    if (isUrgent && isUrgentEligible) {
      const percentageSurcharge = Math.round(agreedAmount * activeConfig.urgentSurchargePercent);
      urgentSurcharge = Math.max(activeConfig.urgentSurchargeFlat, percentageSurcharge);
    }

    const totalRequesterFee = requesterBookingFee + urgentSurcharge;

    // 3. City Tax & Damage Protection Insurance
    const taxAmount = cityTaxRatePercent > 0 ? Math.round(agreedAmount * cityTaxRatePercent) : 0;
    const insuranceFee = hasDamageProtection ? damageProtectionFeeCents : 0;
    const grossChargedToRequester = agreedAmount + totalRequesterFee + taxAmount + insuranceFee;

    // 4. Provider Commission
    let providerCommissionRate = activeConfig.providerCommissionPercent;
    if (providerSubscription === 'PRO_PLUS') {
      providerCommissionRate = Math.max(
        0,
        activeConfig.providerCommissionPercent - activeConfig.proPlusCommissionDiscountPercent
      );
    }
    // Fix IEEE-754 precision issues
    providerCommissionRate = Math.round(providerCommissionRate * 10000) / 10000;

    const providerCommissionAmount = Math.round(agreedAmount * providerCommissionRate);
    const providerPayoutAmount = Math.max(0, agreedAmount - providerCommissionAmount);

    return {
      agreedAmount,
      requesterBookingFee,
      urgentSurcharge,
      totalRequesterFee,
      taxAmount,
      insuranceFee,
      grossChargedToRequester,
      providerCommissionRate,
      providerCommissionAmount,
      providerPayoutAmount,
      currency: currency.toUpperCase(),
      isFeeWaivedByRadiusPlus,
    };
  }
}

import type {
  FinancialReconciliation,
  FunnelMetrics,
  ZoneLiquidity,
} from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';
import { PromotionsService } from '../promotions/promotions.service.ts';

export class AnalyticsService {
  /**
   * Computes the marketplace conversion funnel metrics:
   * Requests -> Matches -> Quotes -> Bookings -> Completions -> Repeat Bookings
   */
  public static getFunnelMetrics(): FunnelMetrics {
    const jobRequests = Array.from(db.jobRequests.values());
    const quotes = Array.from(db.quotes.values());
    const bookings = Array.from(db.bookings.values());

    const requestsCount = jobRequests.length;

    // A job is matched if it received at least one quote or was directly booked
    const matchedJobIds = new Set<string>();
    for (const q of quotes) matchedJobIds.add(q.jobRequestId);
    for (const b of bookings) matchedJobIds.add(b.jobRequestId);
    const matchesCount = matchedJobIds.size;

    const quotesCount = quotes.length;
    const bookingsCount = bookings.length;
    const completionsCount = bookings.filter((b) => b.status === 'COMPLETED' || b.status === 'PAID_OUT').length;

    // Repeat bookings: requesters who booked more than once
    const requesterBookingCounts = new Map<string, number>();
    for (const b of bookings) {
      requesterBookingCounts.set(b.requesterId, (requesterBookingCounts.get(b.requesterId) || 0) + 1);
    }
    let repeatBookingsCount = 0;
    for (const count of requesterBookingCounts.values()) {
      if (count > 1) {
        repeatBookingsCount += count - 1;
      }
    }

    const matchRatePercent = requestsCount > 0 ? Math.round((matchesCount / requestsCount) * 1000) / 10 : 0;
    const bookingConversionPercent = requestsCount > 0 ? Math.round((bookingsCount / requestsCount) * 1000) / 10 : 0;
    const completionRatePercent = bookingsCount > 0 ? Math.round((completionsCount / bookingsCount) * 1000) / 10 : 0;

    return {
      requests: requestsCount,
      matches: matchesCount,
      quotes: quotesCount,
      bookings: bookingsCount,
      completions: completionsCount,
      repeatBookings: repeatBookingsCount,
      matchRatePercent,
      bookingConversionPercent,
      completionRatePercent,
    };
  }

  /**
   * Computes supply liquidity across geographic zones.
   */
  public static getZoneLiquidity(citySlug?: string): ZoneLiquidity[] {
    const providers = Array.from(db.providerProfiles.values()).filter(
      (p) => !citySlug || (p as any).citySlug === citySlug
    );
    const jobs = Array.from(db.jobRequests.values());

    // Group by approx zone
    const zonesMap = new Map<string, { requests: number; matched: number; pros: number; city: string }>();

    for (const p of providers) {
      const zoneKey = p.approxZone || 'zone-default';
      const existing = zonesMap.get(zoneKey) || { requests: 0, matched: 0, pros: 0, city: citySlug || 'san-francisco' };
      existing.pros += 1;
      zonesMap.set(zoneKey, existing);
    }

    for (const j of jobs) {
      const zoneKey = 'zone-default'; // In prototype, map coordinates to zone key
      const existing = zonesMap.get(zoneKey) || { requests: 0, matched: 0, pros: 0, city: citySlug || 'san-francisco' };
      existing.requests += 1;
      if (j.status !== 'REQUESTED') {
        existing.matched += 1;
      }
      zonesMap.set(zoneKey, existing);
    }

    const liquidityResults: ZoneLiquidity[] = [];
    for (const [zoneLabel, data] of zonesMap.entries()) {
      const matchRate = data.requests > 0 ? Math.round((data.matched / data.requests) * 100) : 100;
      liquidityResults.push({
        citySlug: data.city,
        zoneLabel,
        requestCount: data.requests,
        matchRatePercent: matchRate,
        avgResponseTimeMinutes: 14.5,
        activeProsCount: data.pros,
      });
    }

    return liquidityResults;
  }

  /**
   * Performs cent-to-cent financial reconciliation across all payments,
   * fees, commissions, taxes, insurance, and promoted ad billings.
   *
   * Acceptance Criterion: "Analytics dashboards reconcile with payment records to the cent."
   */
  public static reconcileFinancials(): FinancialReconciliation {
    const payments = Array.from(db.payments.values());

    let grossVolumeCents = 0;
    let agreedServicesCents = 0;
    let requesterFeesCents = 0;
    let providerCommissionsCents = 0;
    let taxCollectedCents = 0;
    let insuranceFeesCents = 0;
    let providerPayoutsCents = 0;

    for (const payment of payments) {
      // In our escrow model:
      // payment.grossAmount = agreedAmount + requesterFee + taxAmount + insuranceFee
      // providerPayoutAmount = agreedAmount - providerCommission
      const booking = db.bookings.get(payment.bookingId);
      const agreed = booking ? booking.agreedAmount : payment.providerPayoutAmount + payment.providerCommission;

      grossVolumeCents += payment.grossAmount;
      agreedServicesCents += agreed;
      requesterFeesCents += payment.requesterFee;
      providerCommissionsCents += payment.providerCommission;
      taxCollectedCents += payment.taxAmount || 0;
      insuranceFeesCents += payment.insuranceFee || 0;
      providerPayoutsCents += payment.providerPayoutAmount;
    }

    // Promoted Ads Billing
    let promotedAdSpendCents = 0;
    const adRecords = PromotionsService.getBillingRecords();
    for (const rec of adRecords) {
      promotedAdSpendCents += rec.amountCents;
    }

    // Net Platform Revenue = requesterFees + providerCommissions + insuranceFees + promotedAdSpend
    const netPlatformRevenueCents =
      requesterFeesCents + providerCommissionsCents + insuranceFeesCents + promotedAdSpendCents;

    // Take Rate = Net Platform Revenue / Gross GMV (excluding pure passthrough city tax)
    const effectiveGmv = grossVolumeCents - taxCollectedCents;
    const takeRatePercent =
      effectiveGmv > 0 ? Math.round((netPlatformRevenueCents / effectiveGmv) * 10000) / 100 : 0;

    // Strict Cent-to-Cent Mathematical Reconciliation Verification:
    // 1. Gross Volume must equal agreed + requester fee + tax + insurance fee
    const grossMatchesComponents =
      grossVolumeCents === agreedServicesCents + requesterFeesCents + taxCollectedCents + insuranceFeesCents;

    // 2. Agreed Service Amount must equal provider payout + provider commission
    const serviceMatchesPayoutAndComm = agreedServicesCents === providerPayoutsCents + providerCommissionsCents;

    // 3. Platform Gross Flow Balance: Gross charged = provider payouts + net revenue + tax - ad spend (since ad spend is billed to providers separately)
    const platformFlowBalanced =
      grossVolumeCents === providerPayoutsCents + netPlatformRevenueCents + taxCollectedCents - promotedAdSpendCents;

    const isReconciled = grossMatchesComponents && serviceMatchesPayoutAndComm && platformFlowBalanced;

    return {
      grossVolumeCents,
      agreedServicesCents,
      requesterFeesCents,
      providerCommissionsCents,
      taxCollectedCents,
      insuranceFeesCents,
      promotedAdSpendCents,
      providerPayoutsCents,
      netPlatformRevenueCents,
      takeRatePercent,
      isReconciled,
    };
  }
}

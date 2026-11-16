import type {
  PromotedBillingRecord,
  PromotedListing,
  ProviderProfile,
} from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';

export class PromotionsService {
  public static campaigns: Map<string, PromotedListing> = new Map();
  public static billingRecords: PromotedBillingRecord[] = [];
  public static readonly MAX_SPONSORED_SLOTS = 1; // Strict limit: max 1 sponsored slot per search query

  public static reset(): void {
    this.campaigns.clear();
    this.billingRecords = [];
  }

  /**
   * Creates or updates a sponsored ad campaign for a verified provider.
   */
  public static createCampaign(params: {
    providerId: string;
    citySlug: string;
    categorySlug: string;
    bidCpcCents: number; // e.g. 150 = $1.50 per click
    dailyBudgetCents: number; // e.g. 3000 = $30.00 daily budget
  }): PromotedListing {
    const { providerId, citySlug, categorySlug, bidCpcCents, dailyBudgetCents } = params;

    const provider = db.providerProfiles.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    if (provider.verificationStatus !== 'VERIFIED') {
      throw new Error('Only verified professionals can create promoted listings');
    }

    const campaign: PromotedListing = {
      id: `promo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      providerId,
      citySlug,
      categorySlug,
      bidCpcCents,
      dailyBudgetCents,
      spentTodayCents: 0,
      status: 'ACTIVE',
      impressionsCount: 0,
      clicksCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.campaigns.set(campaign.id, campaign);

    provider.isSponsored = true;
    provider.promotedCampaignId = campaign.id;
    db.providerProfiles.set(provider.id, provider);

    db.logAudit('PROMOTION_CREATED', 'PROMOTION', campaign.id, provider.userId, {
      bidCpcCents,
      dailyBudgetCents,
      categorySlug,
    });

    return campaign;
  }

  /**
   * Applies promoted listings to search results with strict quality guardrails:
   * 1. Max 1 sponsored listing at the top.
   * 2. Must be VERIFIED.
   * 3. Must be physically within the requested search radius.
   * 4. Must match category and have remaining daily budget.
   */
  public static injectPromotedListings(
    searchResults: Array<{ provider: ProviderProfile; distanceKm: number; searchRankScore: number }>,
    params: { citySlug?: string; categorySlug?: string }
  ): Array<{ provider: ProviderProfile; distanceKm: number; searchRankScore: number; isSponsored?: boolean }> {
    if (searchResults.length === 0) return searchResults;

    let sponsoredInjectedCount = 0;
    const finalResults = [...searchResults];

    for (const campaign of this.campaigns.values()) {
      if (campaign.status !== 'ACTIVE' || campaign.spentTodayCents >= campaign.dailyBudgetCents) {
        continue;
      }

      if (params.categorySlug && campaign.categorySlug !== params.categorySlug) {
        continue;
      }

      // Check if provider is among the eligible providers within user's radius
      const matchIndex = finalResults.findIndex((r) => r.provider.id === campaign.providerId);
      if (matchIndex !== -1) {
        // Remove from current position and promote to top slot
        const [promotedItem] = finalResults.splice(matchIndex, 1);
        finalResults.unshift({
          ...promotedItem,
          isSponsored: true,
        });

        // Track impression
        this.recordImpression(campaign.id);
        sponsoredInjectedCount++;

        if (sponsoredInjectedCount >= this.MAX_SPONSORED_SLOTS) {
          break; // Enforce maximum sponsored slots guardrail
        }
      }
    }

    return finalResults;
  }

  public static recordImpression(campaignId: string): void {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return;

    campaign.impressionsCount += 1;
    this.campaigns.set(campaign.id, campaign);
  }

  public static recordClick(campaignId: string): PromotedBillingRecord {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    campaign.clicksCount += 1;
    campaign.spentTodayCents += campaign.bidCpcCents;

    if (campaign.spentTodayCents >= campaign.dailyBudgetCents) {
      campaign.status = 'BUDGET_EXHAUSTED';
    }

    this.campaigns.set(campaign.id, campaign);

    const record: PromotedBillingRecord = {
      id: `bill-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      campaignId: campaign.id,
      providerId: campaign.providerId,
      type: 'CLICK',
      amountCents: campaign.bidCpcCents,
      timestamp: new Date().toISOString(),
    };

    this.billingRecords.push(record);

    db.logAudit('PROMOTION_CLICK_BILLED', 'PROMOTION', campaign.id, campaign.providerId, {
      amountCents: campaign.bidCpcCents,
      spentTodayCents: campaign.spentTodayCents,
    });

    return record;
  }
}


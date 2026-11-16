import type {
  AuditLog,
  Booking,
  BusinessAccount,
  Category,
  ConsolidatedInvoice,
  Dispute,
  InsuranceClaim,
  JobRequest,
  LeadCreditTransaction,
  Message,
  Payment,
  PromotedBillingRecord,
  PromotedListing,
  ProviderProfile,
  Quote,
  RecurringJobTemplate,
  Review,
  Subscription,
  User,
} from '../../../types/src/index.ts';
import { SEED_CATEGORIES } from '../config/categories.seed.ts';
import { GeospatialService } from '../modules/providers/geospatial.service.ts';

export interface OtpRecord {
  id: string;
  destination: string;
  hashedCode: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

export class InMemoryDatabase {
  public categories: Map<string, Category> = new Map();
  public users: Map<string, User> = new Map();
  public providerProfiles: Map<string, ProviderProfile> = new Map();
  public otpRecords: Map<string, OtpRecord> = new Map();
  public jobRequests: Map<string, JobRequest> = new Map();
  public quotes: Map<string, Quote> = new Map();
  public bookings: Map<string, Booking> = new Map();
  public payments: Map<string, Payment> = new Map();
  public reviews: Map<string, Review> = new Map();
  public disputes: Map<string, Dispute> = new Map();
  public messages: Map<string, Message> = new Map();
  public subscriptions: Map<string, Subscription> = new Map();
  public businessAccounts: Map<string, BusinessAccount> = new Map();
  public recurringTemplates: Map<string, RecurringJobTemplate> = new Map();
  public consolidatedInvoices: Map<string, ConsolidatedInvoice> = new Map();
  public promotedListings: Map<string, PromotedListing> = new Map();
  public promotedBillingRecords: PromotedBillingRecord[] = [];
  public insuranceClaims: Map<string, InsuranceClaim> = new Map();
  public leadCreditBalances: Map<string, number> = new Map();
  public leadCreditTransactions: LeadCreditTransaction[] = [];
  public unlockedJobs: Map<string, Set<string>> = new Map();
  public auditLogs: AuditLog[] = [];

  constructor() {
    this.seed();
  }

  public reset(): void {
    this.categories.clear();
    this.users.clear();
    this.providerProfiles.clear();
    this.otpRecords.clear();
    this.jobRequests.clear();
    this.quotes.clear();
    this.bookings.clear();
    this.payments.clear();
    this.reviews.clear();
    this.disputes.clear();
    this.messages.clear();
    this.subscriptions.clear();
    this.businessAccounts.clear();
    this.recurringTemplates.clear();
    this.consolidatedInvoices.clear();
    this.promotedListings.clear();
    this.promotedBillingRecords = [];
    this.insuranceClaims.clear();
    this.leadCreditBalances.clear();
    this.leadCreditTransactions = [];
    this.unlockedJobs.clear();
    this.auditLogs = [];
    this.seed();
  }

  private seed(): void {
    for (const cat of SEED_CATEGORIES) {
      this.categories.set(cat.slug, cat);
      this.categories.set(cat.id, cat);
    }
  }

  public logAudit(
    eventType: string,
    entityType:
      | 'PAYMENT'
      | 'DISPUTE'
      | 'BOOKING'
      | 'PROVIDER'
      | 'USER'
      | 'SUBSCRIPTION'
      | 'QUOTE'
      | 'PROMOTION'
      | 'BUSINESS'
      | 'INSURANCE'
      | 'LEAD_CREDIT',
    entityId: string,
    actorId: string,
    payload: Record<string, any>
  ): AuditLog {
    const entry: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      entityType,
      entityId,
      actorId,
      payload,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.push(entry);
    return entry;
  }

  /**
   * Searches providers within radius with Pro Plus featured placement ranking logic.
   * Featured (PRO_PLUS) providers receive top placement within their geographic radius.
   */
  public findProvidersInRadius(params: {
    latitude: number;
    longitude: number;
    radiusKm: number;
    categorySlug?: string;
    verifiedOnly?: boolean;
    minRating?: number;
  }): Array<{ provider: ProviderProfile; distanceKm: number; searchRankScore: number }> {
    const target = { latitude: params.latitude, longitude: params.longitude };
    const results: Array<{ provider: ProviderProfile; distanceKm: number; searchRankScore: number }> = [];

    for (const provider of this.providerProfiles.values()) {
      if (params.verifiedOnly !== false && provider.verificationStatus !== 'VERIFIED') {
        continue;
      }

      if (
        params.categorySlug &&
        !provider.categories.includes(params.categorySlug)
      ) {
        continue;
      }

      if (params.minRating && provider.ratingAvg < params.minRating) {
        continue;
      }

      const distanceKm = GeospatialService.calculateDistanceKm(target, provider.location);

      if (
        distanceKm <= params.radiusKm &&
        distanceKm <= provider.serviceRadiusKm
      ) {
        // Search ranking algorithm:
        // Base score = (50 - distanceKm) * 2 + (ratingAvg * 10)
        // Featured (PRO_PLUS) boost = +1000 bonus points for top placement
        const isFeatured = provider.isFeatured || provider.subscriptionPlan === 'PRO_PLUS';
        const searchRankScore =
          (isFeatured ? 1000 : 0) +
          (50 - distanceKm) * 2 +
          (provider.ratingAvg || 0) * 10;

        results.push({
          provider,
          distanceKm,
          searchRankScore,
        });
      }
    }

    // Sort by searchRankScore descending (highest score first)
    results.sort((a, b) => b.searchRankScore - a.searchRankScore);
    return results;
  }
}

export const db = new InMemoryDatabase();

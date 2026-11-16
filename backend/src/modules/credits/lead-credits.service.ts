import type {
  LeadCreditPackage,
  LeadCreditTransaction,
} from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';

export class LeadCreditsService {
  private static isFeatureFlagEnabled: boolean =
    process.env.ENABLE_LEAD_CREDITS === 'true' || true; // Default true for Phase 3

  public static transactions: LeadCreditTransaction[] = [];

  public static readonly PACKAGES: LeadCreditPackage[] = [
    { id: 'pkg-starter-10', name: 'Starter Pack (10 Credits)', credits: 10, priceCents: 2900 },
    { id: 'pkg-growth-25', name: 'Growth Pack (25 Credits)', credits: 25, priceCents: 5900 },
    { id: 'pkg-pro-50', name: 'Pro Power Pack (50 Credits)', credits: 50, priceCents: 9900 },
  ];

  public static setFeatureFlag(enabled: boolean): void {
    this.isFeatureFlagEnabled = enabled;
  }

  public static isEnabled(): boolean {
    return this.isFeatureFlagEnabled;
  }

  /**
   * Provider purchases a credit package.
   */
  public static purchasePackage(providerId: string, packageId: string): LeadCreditTransaction {
    if (!this.isEnabled()) {
      throw new Error('Lead credits marketplace is currently disabled by feature flag');
    }

    const pkg = this.PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      throw new Error(`Package ${packageId} not found`);
    }

    const provider = db.providerProfiles.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const currentBalance = provider.leadCreditsBalance || 0;
    const newBalance = currentBalance + pkg.credits;
    provider.leadCreditsBalance = newBalance;
    db.providerProfiles.set(provider.id, provider);

    const transaction: LeadCreditTransaction = {
      id: `lctx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      providerId,
      type: 'PURCHASE',
      credits: pkg.credits,
      amountCents: pkg.priceCents,
      balanceAfter: newBalance,
      createdAt: new Date().toISOString(),
    };

    this.transactions.push(transaction);

    db.logAudit('LEAD_CREDITS_PURCHASED', 'LEAD_CREDIT', transaction.id, provider.userId, {
      packageId,
      credits: pkg.credits,
      priceCents: pkg.priceCents,
      newBalance,
    });

    return transaction;
  }

  /**
   * Provider spends credits to unlock a specific job request.
   */
  public static unlockJob(providerId: string, jobRequestId: string, costCredits: number = 2): LeadCreditTransaction {
    if (!this.isEnabled()) {
      throw new Error('Lead credits marketplace is currently disabled by feature flag');
    }

    const provider = db.providerProfiles.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const job = db.jobRequests.get(jobRequestId);
    if (!job) {
      throw new Error(`Job request ${jobRequestId} not found`);
    }

    // Check if already unlocked
    if (job.unlockedByProviders && job.unlockedByProviders.includes(providerId)) {
      return {
        id: 'already-unlocked',
        providerId,
        type: 'SPEND',
        credits: 0,
        jobRequestId,
        balanceAfter: provider.leadCreditsBalance || 0,
        createdAt: new Date().toISOString(),
      };
    }

    const currentBalance = provider.leadCreditsBalance || 0;
    if (currentBalance < costCredits) {
      throw new Error(
        `Insufficient lead credits. Balance: ${currentBalance}, required: ${costCredits}`
      );
    }

    const newBalance = currentBalance - costCredits;
    provider.leadCreditsBalance = newBalance;
    db.providerProfiles.set(provider.id, provider);

    if (!job.unlockedByProviders) {
      job.unlockedByProviders = [];
    }
    job.unlockedByProviders.push(providerId);
    db.jobRequests.set(job.id, job);

    const transaction: LeadCreditTransaction = {
      id: `lctx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      providerId,
      type: 'SPEND',
      credits: -costCredits,
      jobRequestId,
      balanceAfter: newBalance,
      createdAt: new Date().toISOString(),
    };

    this.transactions.push(transaction);

    db.logAudit('LEAD_UNLOCKED', 'LEAD_CREDIT', transaction.id, provider.userId, {
      jobRequestId,
      costCredits,
      newBalance,
    });

    return transaction;
  }
}

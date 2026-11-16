import { describe, it, expect } from './test-utils.ts';
import { LeadCreditsService } from '../src/modules/credits/lead-credits.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { JobRequest, ProviderProfile } from '../../../types/src/index.ts';

describe('LeadCreditsMarketplace — Feature-Flagged Job Request Unlocking', () => {
  db.reset();

  const pro: ProviderProfile = {
    id: 'pro-credits-1',
    userId: 'usr-pro-credits-1',
    bio: 'Emergency Plumber',
    categories: ['plumbing'],
    serviceRadiusKm: 25,
    workingHours: {},
    licenses: [],
    verificationStatus: 'VERIFIED',
    ratingAvg: 4.8,
    ratingCount: 15,
    location: { latitude: 37.7749, longitude: -122.4194 },
    approxZone: 'zone-sf-1',
    leadCreditsBalance: 0,
    createdAt: new Date().toISOString(),
  };
  db.providerProfiles.set(pro.id, pro);

  const job1: JobRequest = {
    id: 'job-credits-01',
    requesterId: 'usr-req-1',
    categoryId: 'plumbing',
    description: 'Burst water line under kitchen sink',
    photos: [],
    location: { latitude: 37.7755, longitude: -122.418 },
    exactAddress: '456 Mission St Apt 4B',
    isUrgent: true,
    status: 'REQUESTED',
    createdAt: new Date().toISOString(),
  };

  const job2: JobRequest = {
    id: 'job-credits-02',
    requesterId: 'usr-req-2',
    categoryId: 'plumbing',
    description: 'Install water heater tank',
    photos: [],
    location: { latitude: 37.776, longitude: -122.417 },
    exactAddress: '789 Market St',
    isUrgent: false,
    status: 'REQUESTED',
    createdAt: new Date().toISOString(),
  };

  db.jobRequests.set(job1.id, job1);
  db.jobRequests.set(job2.id, job2);

  it('rejects transactions when feature flag is disabled', () => {
    LeadCreditsService.setFeatureFlag(false);

    expect(() => {
      LeadCreditsService.purchasePackage(pro.id, 'pkg-starter-10');
    }).toThrow('Lead credits marketplace is currently disabled by feature flag');

    // Re-enable for the remainder of tests
    LeadCreditsService.setFeatureFlag(true);
  });

  it('allows provider to purchase Starter Pack (10 credits for $29.00)', () => {
    const tx = LeadCreditsService.purchasePackage(pro.id, 'pkg-starter-10');

    expect(tx.id).toBeDefined();
    expect(tx.credits).toBe(10);
    expect(tx.amountCents).toBe(2900);
    expect(tx.balanceAfter).toBe(10);
    expect(pro.leadCreditsBalance).toBe(10);
  });

  it('unlocks job request by spending 2 credits and grants access to job details', () => {
    const unlockTx = LeadCreditsService.unlockJob(pro.id, job1.id, 2);

    expect(unlockTx.id).toBeDefined();
    expect(unlockTx.credits).toBe(-2);
    expect(unlockTx.balanceAfter).toBe(8);
    expect(pro.leadCreditsBalance).toBe(8);

    // Job records unlocking provider
    expect(job1.unlockedByProviders).toBeDefined();
    expect(job1.unlockedByProviders?.includes(pro.id)).toBe(true);
  });

  it('supports idempotent unlocks: unlocking the same job twice does not double-charge', () => {
    const initialBalance = pro.leadCreditsBalance || 8;
    const reUnlockTx = LeadCreditsService.unlockJob(pro.id, job1.id, 2);

    expect(reUnlockTx.credits).toBe(0);
    expect(reUnlockTx.balanceAfter).toBe(initialBalance);
    expect(pro.leadCreditsBalance).toBe(initialBalance);
  });

  it('rejects job unlock when provider has insufficient credit balance', () => {
    // Deplete remaining 8 credits with 4 job unlocks
    for (let i = 0; i < 4; i++) {
      const dummyJob: JobRequest = {
        id: `job-drain-${i}`,
        requesterId: 'usr-dummy',
        categoryId: 'plumbing',
        description: 'Faucet fix',
        photos: [],
        location: { latitude: 37.77, longitude: -122.41 },
        exactAddress: '123 Fake St',
        isUrgent: false,
        status: 'REQUESTED',
        createdAt: new Date().toISOString(),
      };
      db.jobRequests.set(dummyJob.id, dummyJob);
      LeadCreditsService.unlockJob(pro.id, dummyJob.id, 2);
    }

    expect(pro.leadCreditsBalance).toBe(0);

    expect(() => {
      LeadCreditsService.unlockJob(pro.id, job2.id, 2);
    }).toThrow('Insufficient lead credits');
  });
});

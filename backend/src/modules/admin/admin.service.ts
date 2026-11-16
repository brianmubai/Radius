import type { Dispute, ProviderProfile } from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';
import { StorageService } from '../storage/storage.service.ts';

export interface PendingProviderItem {
  provider: ProviderProfile;
  licenseUrls: Array<{
    categorySlug: string;
    licenseNumber: string;
    signedDownloadUrl: string;
  }>;
}

export class AdminService {
  public static getVerificationQueue(): PendingProviderItem[] {
    const queue: PendingProviderItem[] = [];

    for (const provider of db.providerProfiles.values()) {
      if (provider.verificationStatus === 'PENDING') {
        const user = db.users.get(provider.userId);
        const licenseUrls = (provider.licenses || []).map((lic) => ({
          categorySlug: lic.categorySlug,
          licenseNumber: lic.licenseNumber,
          signedDownloadUrl: StorageService.getPresignedDownloadUrl(lic.documentUrl),
        }));

        queue.push({
          provider: {
            ...provider,
            user,
          },
          licenseUrls,
        });
      }
    }

    return queue;
  }

  public static approveProvider(providerId: string, adminId: string): ProviderProfile {
    const provider = db.providerProfiles.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    provider.verificationStatus = 'VERIFIED';
    provider.updatedAt = new Date().toISOString();
    db.providerProfiles.set(provider.id, provider);

    db.logAudit('PROVIDER_VERIFIED', 'PROVIDER', provider.id, adminId, {
      status: 'VERIFIED',
    });

    return provider;
  }

  public static rejectProvider(
    providerId: string,
    adminId: string,
    reason: string
  ): ProviderProfile {
    const provider = db.providerProfiles.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    provider.verificationStatus = 'REJECTED';
    provider.updatedAt = new Date().toISOString();
    db.providerProfiles.set(provider.id, provider);

    db.logAudit('PROVIDER_REJECTED', 'PROVIDER', provider.id, adminId, {
      status: 'REJECTED',
      reason,
    });

    return provider;
  }

  public static getDisputesQueue(): Array<{ dispute: Dispute; booking: any; payment: any }> {
    const list: Array<{ dispute: Dispute; booking: any; payment: any }> = [];

    for (const dispute of db.disputes.values()) {
      const booking = db.bookings.get(dispute.bookingId);
      const payment = booking ? db.payments.get(booking.id) : undefined;

      list.push({
        dispute,
        booking,
        payment,
      });
    }

    return list.sort(
      (a, b) => new Date(b.dispute.createdAt).getTime() - new Date(a.dispute.createdAt).getTime()
    );
  }

  public static getStats() {
    let totalGrossCents = 0;
    let totalPlatformRevenueCents = 0;
    let pendingVerificationsCount = 0;
    let openDisputesCount = 0;

    for (const p of db.providerProfiles.values()) {
      if (p.verificationStatus === 'PENDING') {
        pendingVerificationsCount++;
      }
    }

    for (const d of db.disputes.values()) {
      if (d.status === 'OPEN') {
        openDisputesCount++;
      }
    }

    for (const pay of db.payments.values()) {
      if (pay.status === 'RELEASED') {
        totalGrossCents += pay.grossAmount;
        totalPlatformRevenueCents += pay.requesterFee + pay.providerCommission;
      }
    }

    return {
      pendingVerificationsCount,
      openDisputesCount,
      totalGrossVolume: (totalGrossCents / 100).toFixed(2),
      totalPlatformRevenue: (totalPlatformRevenueCents / 100).toFixed(2),
      totalBookingsCount: db.bookings.size,
      totalUsersCount: db.users.size,
      totalProvidersCount: db.providerProfiles.size,
    };
  }
}

import { describe, it, expect, beforeEach } from './test-utils.ts';
import { SubscriptionService } from '../src/modules/subscriptions/subscription.service.ts';
import { BookingService } from '../src/modules/bookings/booking.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { ProviderProfile, User } from '../../../types/src/index.ts';

describe('Subscriptions & Idempotent Stripe Webhooks', () => {
  let bookingService: BookingService;

  beforeEach(() => {
    db.reset();
    SubscriptionService.clearProcessedEvents();
    bookingService = new BookingService();

    // Seed Requester
    const reqUser: User = {
      id: 'usr-sub-req',
      role: 'REQUESTER',
      name: 'Kelly Requester',
      phone: '+14155557788',
      email: 'kelly@example.com',
      locale: 'en',
      createdAt: new Date().toISOString(),
    };
    db.users.set(reqUser.id, reqUser);

    // Seed Provider
    const provUser: User = {
      id: 'usr-sub-prov',
      role: 'PROVIDER',
      name: 'Leo Mechanic',
      phone: '+14155559900',
      email: 'leo@mechanic.com',
      locale: 'en',
      createdAt: new Date().toISOString(),
    };
    db.users.set(provUser.id, provUser);

    const provProfile: ProviderProfile = {
      id: 'prov-leo-1',
      userId: provUser.id,
      bio: 'Mobile brakes & engine service',
      categories: ['mechanics'],
      serviceRadiusKm: 25,
      workingHours: {},
      licenses: [],
      verificationStatus: 'VERIFIED',
      ratingAvg: 4.9,
      ratingCount: 30,
      subscriptionPlan: 'PRO_BASIC', // free tier default
      isFeatured: false,
      location: { latitude: 37.7749, longitude: -122.4194 },
      approxZone: {
        centerLatitude: 37.77,
        centerLongitude: -122.42,
        radiusMeters: 750,
        label: 'Zone',
      },
    };
    db.providerProfiles.set(provProfile.id, provProfile);

    // Seed Job Request
    db.jobRequests.set('job-mechanic-1', {
      id: 'job-mechanic-1',
      requesterId: reqUser.id,
      categoryId: 'cat-mechanics-02',
      description: 'Brake pads replacement on Toyota Camry',
      photos: [],
      location: { latitude: 37.7749, longitude: -122.4194 },
      exactAddress: '500 Howard St',
      isUrgent: false,
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
    });
  });

  it('charges default 12% commission on PRO_BASIC, then applies 8% immediately upon PRO_PLUS upgrade via webhook', () => {
    // 1. Initial booking on PRO_BASIC (12% commission)
    const { payment: payment1 } = bookingService.createInstantBooking({
      jobRequestId: 'job-mechanic-1',
      providerId: 'prov-leo-1',
      requesterId: 'usr-sub-req',
      agreedAmount: 10000, // $100.00
    });

    expect(payment1.providerCommission).toBe(1200); // 12% of $100 = $12.00
    expect(payment1.providerPayoutAmount).toBe(8800);

    // 2. Stripe Webhook arrives: customer.subscription.created (PRO_PLUS)
    const webhookEvent = {
      id: 'evt_stripe_sub_create_991',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_stripe_12345',
          customer: 'cus_stripe_67890',
          status: 'active',
          metadata: {
            userId: 'usr-sub-prov',
            plan: 'PRO_PLUS',
          },
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        },
      },
    };

    const webhookResult = SubscriptionService.handleStripeWebhook(webhookEvent);
    expect(webhookResult.success).toBe(true);
    expect(webhookResult.duplicate).toBe(false);
    expect(webhookResult.action).toBe('SUBSCRIPTION_APPLIED');

    // Verify provider profile immediately has PRO_PLUS and isFeatured enabled
    const updatedProfile = db.providerProfiles.get('prov-leo-1');
    expect(updatedProfile?.subscriptionPlan).toBe('PRO_PLUS');
    expect(updatedProfile?.isFeatured).toBe(true);

    // 3. Very next booking immediately applies 8% commission without any manual intervention!
    const { payment: payment2 } = bookingService.createInstantBooking({
      jobRequestId: 'job-mechanic-1',
      providerId: 'prov-leo-1',
      requesterId: 'usr-sub-req',
      agreedAmount: 10000, // $100.00
    });

    expect(payment2.providerCommission).toBe(800); // 8% of $100 = $8.00 (4% discount!)
    expect(payment2.providerPayoutAmount).toBe(9200); // $92.00 net payout
  });

  it('guarantees webhook idempotency: duplicate webhook deliveries do not corrupt state', () => {
    const event = {
      id: 'evt_idempotency_test_001',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_dup',
          customer: 'cus_test_dup',
          status: 'active',
          metadata: {
            userId: 'usr-sub-prov',
            plan: 'PRO_PLUS',
          },
        },
      },
    };

    // First delivery
    const res1 = SubscriptionService.handleStripeWebhook(event);
    expect(res1.duplicate).toBe(false);
    expect(res1.action).toBe('SUBSCRIPTION_APPLIED');

    // Duplicate delivery with identical event ID
    const res2 = SubscriptionService.handleStripeWebhook(event);
    expect(res2.duplicate).toBe(true);
    expect(res2.action).toBe('SKIPPED_DUPLICATE_EVENT');
  });

  it('reverts commission back to 12% when subscription is cancelled via webhook', () => {
    // 1. Set to PRO_PLUS
    SubscriptionService.setSubscription({
      userId: 'usr-sub-prov',
      plan: 'PRO_PLUS',
    });

    // 2. Delete webhook event arrives
    const deleteEvent = {
      id: 'evt_stripe_sub_del_102',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test_del',
          metadata: {
            userId: 'usr-sub-prov',
          },
        },
      },
    };

    SubscriptionService.handleStripeWebhook(deleteEvent);

    const profile = db.providerProfiles.get('prov-leo-1');
    expect(profile?.subscriptionPlan).toBe('PRO_BASIC');
    expect(profile?.isFeatured).toBe(false);

    // Next booking charges standard 12% commission
    const { payment } = bookingService.createInstantBooking({
      jobRequestId: 'job-mechanic-1',
      providerId: 'prov-leo-1',
      requesterId: 'usr-sub-req',
      agreedAmount: 20000, // $200.00
    });

    expect(payment.providerCommission).toBe(2400); // 12% of $200 = $24.00
  });

  it('waives booking fee for Radius Plus requesters up to 10 monthly bookings and charges thereafter', () => {
    // Activate Radius Plus for requester
    SubscriptionService.setSubscription({
      userId: 'usr-sub-req',
      plan: 'RADIUS_PLUS',
    });

    // Bookings 1 to 10: fee waived ($0)
    for (let i = 1; i <= 10; i++) {
      const { payment } = bookingService.createInstantBooking({
        jobRequestId: 'job-mechanic-1',
        providerId: 'prov-leo-1',
        requesterId: 'usr-sub-req',
        agreedAmount: 10000,
      });
      expect(payment.requesterFee).toBe(0);
    }

    // 11th booking: cap exceeded, standard 5% fee charged
    const { payment: payment11 } = bookingService.createInstantBooking({
      jobRequestId: 'job-mechanic-1',
      providerId: 'prov-leo-1',
      requesterId: 'usr-sub-req',
      agreedAmount: 10000,
    });
    expect(payment11.requesterFee).toBe(500); // $5.00
  });
});

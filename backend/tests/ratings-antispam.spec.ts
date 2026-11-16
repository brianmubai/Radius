import { describe, it, expect, beforeEach } from './test-utils.ts';
import { RatingAggregationService } from '../src/modules/reviews/rating-aggregation.service.ts';
import { DisputeService } from '../src/modules/disputes/dispute.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { Booking, ProviderProfile, Review, User } from '../../../types/src/index.ts';

describe('RatingsAggregation, Anti-Spam Defense & Dispute Upgrades', () => {
  beforeEach(() => {
    db.reset();

    const provUser: User = {
      id: 'usr-target-provider',
      role: 'PROVIDER',
      name: 'Tom Carpenter',
      phone: '+14155556677',
      email: 'tom@carpenter.com',
      locale: 'en',
      createdAt: new Date().toISOString(),
    };
    db.users.set(provUser.id, provUser);

    const provProfile: ProviderProfile = {
      id: 'prov-tom-1',
      userId: provUser.id,
      bio: 'Master carpenter',
      categories: ['carpentry'],
      serviceRadiusKm: 20,
      workingHours: {},
      licenses: [],
      verificationStatus: 'VERIFIED',
      ratingAvg: 0.0,
      ratingCount: 0,
      location: { latitude: 37.7749, longitude: -122.4194 },
      approxZone: {
        centerLatitude: 37.77,
        centerLongitude: -122.42,
        radiusMeters: 750,
        label: 'Zone',
      },
    };
    db.providerProfiles.set(provProfile.id, provProfile);
  });

  it('aggregates legitimate customer reviews into accurate ratingAvg and ratingCount', () => {
    // 3 legitimate distinct customers leave reviews
    const r1: Review = {
      id: 'rev-legit-1',
      bookingId: 'book-1',
      reviewerId: 'customer-1',
      targetUserId: 'usr-target-provider',
      rating: 5,
      comment: 'Excellent work!',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    };
    const r2: Review = {
      id: 'rev-legit-2',
      bookingId: 'book-2',
      reviewerId: 'customer-2',
      targetUserId: 'usr-target-provider',
      rating: 4,
      comment: 'Very good carpenter.',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    };
    const r3: Review = {
      id: 'rev-legit-3',
      bookingId: 'book-3',
      reviewerId: 'customer-3',
      targetUserId: 'usr-target-provider',
      rating: 5,
      comment: 'Punctual and clean.',
      createdAt: new Date(Date.now() - 10800000).toISOString(),
    };

    db.reviews.set(r1.id, r1);
    db.reviews.set(r2.id, r2);
    db.reviews.set(r3.id, r3);

    const result = RatingAggregationService.runAggregationJob();
    expect(result.processedReviewsCount).toBe(3);
    expect(result.flaggedSpamCount).toBe(0);

    const provider = db.providerProfiles.get('prov-tom-1');
    expect(provider?.ratingCount).toBe(3);
    // (5 + 4 + 5) / 3 = 14 / 3 = 4.67
    expect(provider?.ratingAvg).toBe(4.67);
  });

  it('detects collusive review spam from identical account pairs and strips them from the rating', () => {
    // Customer 1 leaves 1 legitimate review
    const legitReview: Review = {
      id: 'rev-pair-1',
      bookingId: 'book-p1',
      reviewerId: 'shill-account-x',
      targetUserId: 'usr-target-provider',
      rating: 5,
      comment: 'First job.',
      createdAt: new Date(Date.now() - 50000000).toISOString(),
    };
    // The same user leaves 2 more repetitive rapid reviews to artificially inflate rating
    const spamReview1: Review = {
      id: 'rev-pair-2',
      bookingId: 'book-p2',
      reviewerId: 'shill-account-x',
      targetUserId: 'usr-target-provider',
      rating: 5,
      comment: 'Spam 5-star boost 1.',
      createdAt: new Date(Date.now() - 30000000).toISOString(),
    };
    const spamReview2: Review = {
      id: 'rev-pair-3',
      bookingId: 'book-p3',
      reviewerId: 'shill-account-x',
      targetUserId: 'usr-target-provider',
      rating: 5,
      comment: 'Spam 5-star boost 2.',
      createdAt: new Date(Date.now() - 10000000).toISOString(),
    };

    // Another customer leaves a 3-star review
    const customer2Review: Review = {
      id: 'rev-cust-2',
      bookingId: 'book-c2',
      reviewerId: 'customer-honest',
      targetUserId: 'usr-target-provider',
      rating: 3,
      comment: 'Average job.',
      createdAt: new Date(Date.now() - 20000000).toISOString(),
    };

    db.reviews.set(legitReview.id, legitReview);
    db.reviews.set(spamReview1.id, spamReview1);
    db.reviews.set(spamReview2.id, spamReview2);
    db.reviews.set(customer2Review.id, customer2Review);

    // Run aggregation and anti-spam check
    const aggResult = RatingAggregationService.runAggregationJob();
    expect(aggResult.flaggedSpamCount).toBe(2);

    // Verify spam reviews were flagged with reason
    const flagged1 = db.reviews.get(spamReview1.id);
    const flagged2 = db.reviews.get(spamReview2.id);
    expect(flagged1?.isFlaggedSpam).toBe(true);
    expect(flagged1?.spamReason).toBe('SUSPICIOUS_ACCOUNT_PAIR_COLLUSION');
    expect(flagged2?.isFlaggedSpam).toBe(true);

    // Provider rating must ONLY count the 2 non-spam reviews: 5 and 3 -> avg = 4.0
    const provider = db.providerProfiles.get('prov-tom-1');
    expect(provider?.ratingCount).toBe(2);
    expect(provider?.ratingAvg).toBe(4.0);
  });

  it('supports structured dispute creation with evidence and SLA computation', () => {
    // Seed booking
    const booking: Booking = {
      id: 'book-dispute-test',
      jobRequestId: 'job-d1',
      providerId: 'prov-tom-1',
      requesterId: 'usr-cust-dispute',
      agreedAmount: 25000,
      currency: 'USD',
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.bookings.set(booking.id, booking);

    const dispute = DisputeService.openDispute({
      bookingId: 'book-dispute-test',
      openedBy: 'usr-cust-dispute',
      reason: 'PROPERTY_DAMAGE',
      evidence: [
        {
          fileKey: 'disputes/damage_photo1.jpg',
          fileUrl: 'https://storage.radius.app/disputes/damage_photo1.jpg',
          description: 'Cracked granite countertop during installation',
        },
      ],
    });

    expect(dispute.status).toBe('OPEN');
    expect(dispute.reason).toBe('PROPERTY_DAMAGE');
    expect(dispute.evidence.length).toBe(1);
    expect(dispute.slaDueAt).toBeDefined();

    // Verify SLA calculation
    const disputesWithSla = DisputeService.getDisputesWithSla();
    expect(disputesWithSla.length).toBe(1);
    expect(disputesWithSla[0].hoursRemaining).toBeGreaterThan(45);
    expect(disputesWithSla[0].isSlaBreached).toBe(false);
  });
});

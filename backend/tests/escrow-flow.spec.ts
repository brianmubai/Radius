import { describe, it, expect, beforeEach } from './test-utils.ts';
import { BookingService } from '../src/modules/bookings/booking.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { ProviderProfile, User } from '../../../types/src/index.ts';

describe('EscrowFlow — Stripe Test Mode & Payment Lifecycle', () => {
  let bookingService: BookingService;

  beforeEach(() => {
    db.reset();
    bookingService = new BookingService();

    // Create seed Requester
    const requester: User = {
      id: 'usr-requester-1',
      role: 'REQUESTER',
      name: 'Alice Requester',
      phone: '+14155550100',
      email: 'alice@example.com',
      locale: 'en',
      createdAt: new Date().toISOString(),
    };
    db.users.set(requester.id, requester);

    // Create seed Provider
    const providerUser: User = {
      id: 'usr-provider-1',
      role: 'PROVIDER',
      name: 'Bob Carpenter',
      phone: '+14155550200',
      email: 'bob@example.com',
      locale: 'en',
      createdAt: new Date().toISOString(),
    };
    db.users.set(providerUser.id, providerUser);

    const providerProfile: ProviderProfile = {
      id: 'prov-carpenter-1',
      userId: providerUser.id,
      bio: 'Master carpenter',
      categories: ['carpentry'],
      serviceRadiusKm: 25,
      workingHours: {},
      licenses: [],
      verificationStatus: 'VERIFIED',
      ratingAvg: 5.0,
      ratingCount: 12,
      location: { latitude: 37.7749, longitude: -122.4194 },
      approxZone: {
        centerLatitude: 37.77,
        centerLongitude: -122.42,
        radiusMeters: 750,
        label: 'Zone',
      },
    };
    db.providerProfiles.set(providerProfile.id, providerProfile);

    // Seed Job Request
    db.jobRequests.set('job-1', {
      id: 'job-1',
      requesterId: requester.id,
      categoryId: 'cat-carpentry-01',
      description: 'Build custom kitchen shelves',
      photos: [],
      location: { latitude: 37.7749, longitude: -122.4194 },
      exactAddress: '456 Mission St, Apt 3B',
      isUrgent: false,
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
    });
  });

  it('completes the full escrow lifecycle: instant hold -> job complete -> confirm -> release payout', () => {
    const agreedAmount = 20000; // $200.00 in cents

    // 1. Instant Booking & Escrow Hold
    const { booking, payment } = bookingService.createInstantBooking({
      jobRequestId: 'job-1',
      providerId: 'prov-carpenter-1',
      requesterId: 'usr-requester-1',
      agreedAmount,
      currency: 'USD',
    });

    expect(booking.status).toBe('BOOKED');
    expect(payment.status).toBe('HELD');
    expect(payment.grossAmount).toBe(21000); // $200 agreed + 5% fee ($10) = $210
    expect(payment.requesterFee).toBe(1000); // $10.00
    expect(payment.providerCommission).toBe(2400); // 12% of $200 = $24.00
    expect(payment.providerPayoutAmount).toBe(17600); // $200 - $24 = $176.00
    expect(payment.stripePaymentIntentId).toBeDefined();

    // Verify audit log for hold
    const holdAudit = db.auditLogs.find(
      (a) => a.eventType === 'PAYMENT_HELD' && a.entityId === payment.id
    );
    expect(holdAudit).toBeDefined();

    // 2. Provider starts job
    const started = bookingService.transitionBooking(booking.id, 'IN_PROGRESS', {
      actorId: 'usr-provider-1',
      actorRole: 'PROVIDER',
    });
    expect(started.status).toBe('IN_PROGRESS');

    // 3. Provider marks job complete
    const completed = bookingService.transitionBooking(booking.id, 'COMPLETED', {
      actorId: 'usr-provider-1',
      actorRole: 'PROVIDER',
    });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedAt).toBeDefined();

    // Payment still held
    let currentPayment = bookingService.getBookingPayment(booking.id);
    expect(currentPayment?.status).toBe('HELD');

    // 4. Requester confirms completion
    const paidOut = bookingService.transitionBooking(booking.id, 'PAID_OUT', {
      actorId: 'usr-requester-1',
      actorRole: 'REQUESTER',
    });
    expect(paidOut.status).toBe('PAID_OUT');
    expect(paidOut.confirmedAt).toBeDefined();

    // Payment captured & released to provider
    currentPayment = bookingService.getBookingPayment(booking.id);
    expect(currentPayment?.status).toBe('RELEASED');
    expect(currentPayment?.stripeTransferId).toBeDefined();
    expect(currentPayment?.releasedAt).toBeDefined();

    // Verify audit log for release
    const releaseAudit = db.auditLogs.find(
      (a) => a.eventType === 'PAYMENT_RELEASED' && a.entityId === payment.id
    );
    expect(releaseAudit).toBeDefined();
    expect(releaseAudit?.payload.providerPayoutAmount).toBe(17600);
    expect(releaseAudit?.payload.platformRevenue).toBe(3400); // $10 booking fee + $24 commission
  });

  it('triggers 72-hour auto-confirmation when requester is non-responsive', () => {
    const agreedAmount = 15000; // $150.00
    const { booking } = bookingService.createInstantBooking({
      jobRequestId: 'job-1',
      providerId: 'prov-carpenter-1',
      requesterId: 'usr-requester-1',
      agreedAmount,
    });

    bookingService.transitionBooking(booking.id, 'IN_PROGRESS', {
      actorId: 'usr-provider-1',
      actorRole: 'PROVIDER',
    });

    const completed = bookingService.transitionBooking(booking.id, 'COMPLETED', {
      actorId: 'usr-provider-1',
      actorRole: 'PROVIDER',
    });

    // Simulate completion time 75 hours ago
    completed.completedAt = new Date(Date.now() - 75 * 60 * 60 * 1000).toISOString();
    db.bookings.set(completed.id, completed);

    // Run auto-confirm job
    const autoConfirmed = bookingService.processAutoConfirmations(72);
    expect(autoConfirmed.length).toBe(1);
    expect(autoConfirmed[0].id).toBe(booking.id);
    expect(autoConfirmed[0].status).toBe('PAID_OUT');

    const payment = bookingService.getBookingPayment(booking.id);
    expect(payment?.status).toBe('RELEASED');
  });

  it('holds funds during dispute and supports administrative refund or release', () => {
    const agreedAmount = 30000; // $300.00
    const { booking } = bookingService.createInstantBooking({
      jobRequestId: 'job-1',
      providerId: 'prov-carpenter-1',
      requesterId: 'usr-requester-1',
      agreedAmount,
    });

    bookingService.transitionBooking(booking.id, 'IN_PROGRESS', {
      actorId: 'usr-provider-1',
      actorRole: 'PROVIDER',
    });

    bookingService.transitionBooking(booking.id, 'COMPLETED', {
      actorId: 'usr-provider-1',
      actorRole: 'PROVIDER',
    });

    // Requester opens dispute
    const dispute = bookingService.openDispute({
      bookingId: booking.id,
      openedBy: 'usr-requester-1',
      reason: 'Shelves installed unevenly and scratched floor',
    });

    expect(dispute.status).toBe('OPEN');
    let currentBooking = db.bookings.get(booking.id);
    expect(currentBooking?.status).toBe('DISPUTED');

    let currentPayment = bookingService.getBookingPayment(booking.id);
    expect(currentPayment?.status).toBe('DISPUTED');

    // Admin resolves dispute in favor of requester with full refund
    const resolved = bookingService.resolveDispute({
      disputeId: dispute.id,
      adminId: 'admin-super-1',
      resolution: 'RESOLVED_REFUNDED',
      notes: 'Customer photographic evidence verified. Full refund issued.',
    });

    expect(resolved.status).toBe('RESOLVED_REFUNDED');
    currentBooking = db.bookings.get(booking.id);
    expect(currentBooking?.status).toBe('CANCELLED');

    currentPayment = bookingService.getBookingPayment(booking.id);
    expect(currentPayment?.status).toBe('REFUNDED');
  });
});

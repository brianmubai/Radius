import { describe, it, expect, beforeEach } from './test-utils.ts';
import { AuthService } from '../src/modules/auth/auth.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import { BookingService } from '../src/modules/bookings/booking.service.ts';
import type { ProviderProfile, User } from '../../../types/src/index.ts';

describe('Privacy & Authentication Security Guardrails', () => {
  beforeEach(() => {
    db.reset();
  });

  it('authenticates user via OTP, generates JWTs, and enforces attempt limits', () => {
    const destination = '+14155559876';

    // 1. Send OTP
    const otpResult = AuthService.sendOtp(destination);
    expect(otpResult.destination).toBe(destination);
    expect(otpResult.mockCode).toBe('123456');

    // Verify code is hashed in database, not stored in plain text
    const storedRecord = db.otpRecords.get(destination);
    expect(storedRecord).toBeDefined();
    expect(storedRecord?.hashedCode).not.toBe('123456');
    expect(storedRecord?.hashedCode.length).toBe(64); // SHA-256 hex string

    // 2. Reject wrong code
    expect(() => {
      AuthService.verifyOtp(destination, '000000');
    }).toThrow();

    // 3. Successful verification
    const tokens = AuthService.verifyOtp(destination, '123456', 'Sam Requester', 'REQUESTER');
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.user.name).toBe('Sam Requester');

    // 4. Token validation
    const payload = AuthService.verifyToken(tokens.accessToken);
    expect(payload.sub).toBe(tokens.user.id);
    expect(payload.role).toBe('REQUESTER');

    // 5. Refresh token
    const refreshed = AuthService.refreshAccessToken(tokens.refreshToken);
    expect(refreshed.accessToken).toBeDefined();
  });

  it('locks out verification after 5 failed attempts', () => {
    const destination = 'lockout@radius.local';
    AuthService.sendOtp(destination);

    for (let i = 0; i < 5; i++) {
      try {
        AuthService.verifyOtp(destination, '999999');
      } catch {
        // expected
      }
    }

    // 6th attempt should throw too many attempts and delete record
    expect(() => {
      AuthService.verifyOtp(destination, '123456');
    }).toThrow();
  });

  it('enforces privacy: off-platform contact details (phone, email) are HIDDEN before booking confirmation', () => {
    const providerUser: User = {
      id: 'usr-electrician-1',
      role: 'PROVIDER',
      name: 'Dave Electrician',
      phone: '+14155554321',
      email: 'dave@electrician.com',
      locale: 'en',
      createdAt: new Date().toISOString(),
    };
    db.users.set(providerUser.id, providerUser);

    const providerProfile: ProviderProfile = {
      id: 'prov-elec-1',
      userId: providerUser.id,
      bio: 'Licensed electrician',
      categories: ['electrical'],
      serviceRadiusKm: 15,
      workingHours: {},
      licenses: [],
      verificationStatus: 'VERIFIED',
      ratingAvg: 4.9,
      ratingCount: 18,
      location: { latitude: 37.7749, longitude: -122.4194 },
      approxZone: {
        centerLatitude: 37.77,
        centerLongitude: -122.42,
        radiusMeters: 750,
        label: 'Approx Zone',
      },
    };
    db.providerProfiles.set(providerProfile.id, providerProfile);

    // 1. Unconfirmed Requester inspecting Provider
    const sanitizedPriorToBooking = AuthService.sanitizeContactDetails(
      providerUser,
      false // Not confirmed
    );

    expect(sanitizedPriorToBooking.name).toBe('Dave Electrician');
    expect(sanitizedPriorToBooking.phone).toBeUndefined();
    expect(sanitizedPriorToBooking.email).toBeUndefined();

    // 2. Confirmed Booking: create booking
    const bookingService = new BookingService();
    db.jobRequests.set('job-elec-1', {
      id: 'job-elec-1',
      requesterId: 'usr-cust-1',
      categoryId: 'cat-electrical-07',
      description: 'Replace breaker',
      photos: [],
      location: { latitude: 37.7749, longitude: -122.4194 },
      exactAddress: '100 Sunset Blvd',
      isUrgent: false,
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
    });

    const { booking } = bookingService.createInstantBooking({
      jobRequestId: 'job-elec-1',
      providerId: 'prov-elec-1',
      requesterId: 'usr-cust-1',
      agreedAmount: 25000,
    });

    expect(booking.status).toBe('BOOKED');

    // Now viewer is authorized because booking is confirmed
    const revealedAfterBooking = AuthService.sanitizeContactDetails(
      providerUser,
      true // Confirmed booking participant
    );

    expect(revealedAfterBooking.phone).toBe('+14155554321');
    expect(revealedAfterBooking.email).toBe('dave@electrician.com');
  });
});

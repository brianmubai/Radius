import { describe, it, expect, beforeEach } from './test-utils.ts';
import { QuoteService } from '../src/modules/quotes/quote.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { ProviderProfile, User } from '../../../types/src/index.ts';

describe('QuotesLifecycle & Race Condition Protection', () => {
  let quoteService: QuoteService;

  beforeEach(() => {
    db.reset();
    quoteService = new QuoteService();

    // Requester
    const requester: User = {
      id: 'req-quote-user',
      role: 'REQUESTER',
      name: 'Michael Requester',
      phone: '+14155551001',
      email: 'michael@example.com',
      locale: 'en',
      createdAt: new Date().toISOString(),
    };
    db.users.set(requester.id, requester);

    // 3 Providers
    ['prov-1', 'prov-2', 'prov-3'].forEach((id, index) => {
      const pUser: User = {
        id: `user-${id}`,
        role: 'PROVIDER',
        name: `Pro ${index + 1}`,
        phone: `+1415555200${index + 1}`,
        email: `pro${index + 1}@example.com`,
        locale: 'en',
        createdAt: new Date().toISOString(),
      };
      db.users.set(pUser.id, pUser);

      const pProfile: ProviderProfile = {
        id,
        userId: pUser.id,
        bio: `Specialist ${index + 1}`,
        categories: ['plumbing'],
        serviceRadiusKm: 25,
        workingHours: {},
        licenses: [],
        verificationStatus: 'VERIFIED',
        ratingAvg: 4.8,
        ratingCount: 15,
        location: { latitude: 37.7749, longitude: -122.4194 },
        approxZone: {
          centerLatitude: 37.77,
          centerLongitude: -122.42,
          radiusMeters: 750,
          label: 'Zone',
        },
      };
      db.providerProfiles.set(id, pProfile);
    });

    // Job Request
    db.jobRequests.set('job-plumbing-req', {
      id: 'job-plumbing-req',
      requesterId: 'req-quote-user',
      categoryId: 'cat-plumbing-06',
      description: 'Replace leaking mainline pipe under sink',
      photos: [],
      location: { latitude: 37.7749, longitude: -122.4194 },
      exactAddress: '888 Brannan St',
      isUrgent: false,
      status: 'REQUESTED',
      quotesCount: 0,
      createdAt: new Date().toISOString(),
    });
  });

  it('allows 3 providers to submit quotes and accepts one, expiring all others automatically', () => {
    // 1. Three providers submit competitive quotes
    const quote1 = quoteService.submitQuote({
      jobRequestId: 'job-plumbing-req',
      providerId: 'prov-1',
      amount: 25000, // $250.00
      note: 'Can do it tomorrow morning with OEM brass fittings.',
    });

    const quote2 = quoteService.submitQuote({
      jobRequestId: 'job-plumbing-req',
      providerId: 'prov-2',
      amount: 19500, // $195.00
      note: 'Available today by 2 PM. 1-year warranty included.',
    });

    const quote3 = quoteService.submitQuote({
      jobRequestId: 'job-plumbing-req',
      providerId: 'prov-3',
      amount: 22000, // $220.00
      note: 'Master plumber with 20 yrs experience.',
    });

    expect(quote1.status).toBe('PENDING');
    expect(quote2.status).toBe('PENDING');
    expect(quote3.status).toBe('PENDING');

    const job = db.jobRequests.get('job-plumbing-req');
    expect(job?.status).toBe('QUOTED');
    expect(job?.quotesCount).toBe(3);

    // 2. Requester compares and accepts Quote 2 ($195.00)
    const result = quoteService.acceptQuote({
      quoteId: quote2.id,
      requesterId: 'req-quote-user',
    });

    // 3. Verify winning quote is ACCEPTED
    expect(result.acceptedQuote.status).toBe('ACCEPTED');
    expect(result.booking).toBeDefined();
    expect(result.booking.providerId).toBe('prov-2');
    expect(result.booking.agreedAmount).toBe(19500);
    expect(result.booking.status).toBe('BOOKED');
    expect(result.payment.status).toBe('HELD');

    // 4. Verify all competing quotes were expired automatically
    expect(result.expiredQuotesCount).toBe(2);

    const updatedQ1 = db.quotes.get(quote1.id);
    const updatedQ3 = db.quotes.get(quote3.id);
    expect(updatedQ1?.status).toBe('EXPIRED');
    expect(updatedQ3?.status).toBe('EXPIRED');

    // 5. Verify job status updated to BOOKED
    const finalJob = db.jobRequests.get('job-plumbing-req');
    expect(finalJob?.status).toBe('BOOKED');
  });

  it('rejects quote acceptance race condition when competing request races to accept', () => {
    const quote1 = quoteService.submitQuote({
      jobRequestId: 'job-plumbing-req',
      providerId: 'prov-1',
      amount: 20000,
    });
    const quote2 = quoteService.submitQuote({
      jobRequestId: 'job-plumbing-req',
      providerId: 'prov-2',
      amount: 21000,
    });

    // First acceptance succeeds
    quoteService.acceptQuote({
      quoteId: quote1.id,
      requesterId: 'req-quote-user',
    });

    // Second concurrent / delayed attempt to accept quote 2 MUST be rejected
    expect(() => {
      quoteService.acceptQuote({
        quoteId: quote2.id,
        requesterId: 'req-quote-user',
      });
    }).toThrow();
  });

  it('prohibits non-requesters from accepting quotes', () => {
    const quote = quoteService.submitQuote({
      jobRequestId: 'job-plumbing-req',
      providerId: 'prov-1',
      amount: 15000,
    });

    expect(() => {
      quoteService.acceptQuote({
        quoteId: quote.id,
        requesterId: 'imposter-user-id',
      });
    }).toThrow();
  });
});

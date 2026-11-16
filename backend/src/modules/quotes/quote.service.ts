import type {
  Booking,
  JobRequest,
  Payment,
  Quote,
  QuoteStatus,
} from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';
import { BookingService } from '../bookings/booking.service.ts';
import { PricingService } from '../pricing/pricing.service.ts';
import { ExpoPushService } from '../notifications/push.service.ts';
import { SocketHub } from '../realtime/socket.hub.ts';

export class QuoteService {
  private bookingService: BookingService;
  private pricingService: PricingService;

  constructor(bookingService?: BookingService, pricingService?: PricingService) {
    this.pricingService = pricingService || new PricingService();
    this.bookingService = bookingService || new BookingService(this.pricingService);
  }

  /**
   * Provider submits a quote on an active JobRequest.
   */
  public submitQuote(params: {
    jobRequestId: string;
    providerId: string;
    amount: number; // in cents
    currency?: string;
    note?: string;
  }): Quote {
    const { jobRequestId, providerId, amount, currency = 'USD', note } = params;

    const job = db.jobRequests.get(jobRequestId);
    if (!job) {
      throw new Error(`Job request ${jobRequestId} not found`);
    }

    if (job.status !== 'REQUESTED' && job.status !== 'QUOTED') {
      throw new Error(`Cannot submit quote on job with status '${job.status}'`);
    }

    const provider = db.providerProfiles.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    if (amount <= 0) {
      throw new Error('Quote amount must be greater than zero');
    }

    // Check if provider already has an active quote for this job
    for (const q of db.quotes.values()) {
      if (q.jobRequestId === jobRequestId && q.providerId === providerId && q.status === 'PENDING') {
        throw new Error('You already have an active pending quote for this job request');
      }
    }

    const quote: Quote = {
      id: `quote-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      jobRequestId,
      providerId,
      amount,
      currency: currency.toUpperCase(),
      note,
      status: 'PENDING',
      provider: {
        id: provider.id,
        bio: provider.bio,
        ratingAvg: provider.ratingAvg,
        ratingCount: provider.ratingCount,
        isFeatured: provider.isFeatured,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.quotes.set(quote.id, quote);

    // Update job status to QUOTED if still REQUESTED
    job.status = 'QUOTED';
    job.quotesCount = (job.quotesCount || 0) + 1;
    job.updatedAt = new Date().toISOString();
    db.jobRequests.set(job.id, job);

    db.logAudit('QUOTE_CREATED', 'QUOTE', quote.id, provider.userId, {
      jobRequestId,
      amount,
    });

    // Notify requester via Push & WebSocket
    const requester = db.users.get(job.requesterId);
    if (requester?.expoPushToken) {
      ExpoPushService.sendPushNotification({
        to: requester.expoPushToken,
        title: 'New Quote Received',
        body: `A verified professional quoted $${(amount / 100).toFixed(2)} on your request.`,
        data: { jobRequestId, quoteId: quote.id },
      });
    }

    SocketHub.broadcastToUser(job.requesterId, 'quote:received', {
      jobRequestId,
      quote,
    });

    return quote;
  }

  /**
   * Requester accepts one quote.
   * Race-condition safe: locks the job request, accepts winning quote,
   * automatically expires all competing quotes, and creates Booking with escrow hold.
   */
  public acceptQuote(params: {
    quoteId: string;
    requesterId: string;
    scheduledAt?: string;
  }): { booking: Booking; payment: Payment; acceptedQuote: Quote; expiredQuotesCount: number } {
    const { quoteId, requesterId, scheduledAt } = params;

    const winningQuote = db.quotes.get(quoteId);
    if (!winningQuote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    if (winningQuote.status !== 'PENDING') {
      throw new Error(`Quote is no longer pending (current status: ${winningQuote.status})`);
    }

    const job = db.jobRequests.get(winningQuote.jobRequestId);
    if (!job) {
      throw new Error(`Associated job request not found`);
    }

    if (job.requesterId !== requesterId) {
      throw new Error('Only the job requester can accept a quote');
    }

    // Atomic race-condition check: ensure job hasn't already been booked or cancelled
    if (job.status === 'BOOKED' || job.status === 'IN_PROGRESS' || job.status === 'COMPLETED' || job.status === 'PAID_OUT') {
      throw new Error(`Job request has already been booked`);
    }

    if (job.status === 'CANCELLED') {
      throw new Error(`Job request has been cancelled`);
    }

    // 1. Mark winning quote as ACCEPTED
    winningQuote.status = 'ACCEPTED';
    winningQuote.updatedAt = new Date().toISOString();
    db.quotes.set(winningQuote.id, winningQuote);

    // 2. Automatically expire all other competing quotes for this job
    let expiredQuotesCount = 0;
    for (const q of db.quotes.values()) {
      if (q.jobRequestId === job.id && q.id !== winningQuote.id && q.status === 'PENDING') {
        q.status = 'EXPIRED';
        q.updatedAt = new Date().toISOString();
        db.quotes.set(q.id, q);
        expiredQuotesCount++;

        // Notify competing providers that quote has expired
        const losingProvider = db.providerProfiles.get(q.providerId);
        if (losingProvider) {
          SocketHub.broadcastToUser(losingProvider.userId, 'quote:expired', {
            quoteId: q.id,
            jobRequestId: job.id,
          });
        }
      }
    }

    // 3. Create Booking & place funds in Escrow Hold
    const category = db.categories.get(job.categoryId);
    const { booking, payment } = this.bookingService.createInstantBooking({
      jobRequestId: job.id,
      providerId: winningQuote.providerId,
      requesterId,
      agreedAmount: winningQuote.amount,
      currency: winningQuote.currency,
      scheduledAt,
      isUrgent: job.isUrgent,
      isUrgentEligible: category?.isUrgentEligible || false,
    });

    booking.quoteId = winningQuote.id;
    db.bookings.set(booking.id, booking);

    // 4. Update Job Request status
    job.status = 'BOOKED';
    job.updatedAt = new Date().toISOString();
    db.jobRequests.set(job.id, job);

    db.logAudit('QUOTE_ACCEPTED', 'QUOTE', winningQuote.id, requesterId, {
      bookingId: booking.id,
      agreedAmount: winningQuote.amount,
      expiredQuotesCount,
    });

    // Notify winning provider
    const winningProvider = db.providerProfiles.get(winningQuote.providerId);
    if (winningProvider) {
      const providerUser = db.users.get(winningProvider.userId);
      if (providerUser?.expoPushToken) {
        ExpoPushService.sendPushNotification({
          to: providerUser.expoPushToken,
          title: 'Quote Accepted! Job Booked',
          body: `Your quote for $${(winningQuote.amount / 100).toFixed(2)} was accepted. Funds are secured in escrow.`,
          data: { bookingId: booking.id, jobRequestId: job.id },
          priority: 'high',
        });
      }

      SocketHub.broadcastToUser(winningProvider.userId, 'quote:accepted', {
        booking,
        payment,
      });
    }

    return {
      booking,
      payment,
      acceptedQuote: winningQuote,
      expiredQuotesCount,
    };
  }

  public getQuotesForJob(jobRequestId: string, viewerId: string): Quote[] {
    const job = db.jobRequests.get(jobRequestId);
    if (!job) {
      throw new Error(`Job request ${jobRequestId} not found`);
    }

    const quotes: Quote[] = [];
    const isRequester = job.requesterId === viewerId;

    for (const q of db.quotes.values()) {
      if (q.jobRequestId === jobRequestId) {
        const provider = db.providerProfiles.get(q.providerId);
        // Providers can only see their own quotes unless viewer is the requester or admin
        if (isRequester || provider?.userId === viewerId) {
          quotes.push(q);
        }
      }
    }

    return quotes.sort((a, b) => a.amount - b.amount);
  }
}

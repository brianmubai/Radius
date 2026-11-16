import * as http from 'node:http';
import { URL } from 'node:url';
import { db } from './db/in-memory-db.ts';
import { AuthService } from './modules/auth/auth.service.ts';
import { BookingService } from './modules/bookings/booking.service.ts';
import { GeospatialService } from './modules/providers/geospatial.service.ts';
import { ReviewService } from './modules/reviews/review.service.ts';
import { StorageService } from './modules/storage/storage.service.ts';
import { AdminService } from './modules/admin/admin.service.ts';
import { MessageService } from './modules/messages/message.service.ts';
import { PricingService } from './modules/pricing/pricing.service.ts';
import { QuoteService } from './modules/quotes/quote.service.ts';
import { SubscriptionService } from './modules/subscriptions/subscription.service.ts';
import { DisputeService } from './modules/disputes/dispute.service.ts';
import { RatingAggregationService } from './modules/reviews/rating-aggregation.service.ts';
import { ExpoPushService } from './modules/notifications/push.service.ts';
import { SocketHub } from './modules/realtime/socket.hub.ts';
import { CityService } from './modules/cities/city.service.ts';
import { PromotionsService } from './modules/promotions/promotions.service.ts';
import { BusinessService } from './modules/business/business.service.ts';
import { LeadCreditsService } from './modules/credits/lead-credits.service.ts';
import { InsuranceService } from './modules/insurance/insurance.service.ts';
import { AnalyticsService } from './modules/analytics/analytics.service.ts';
import { geoCache, GeoCacheService } from './modules/cache/geo-cache.service.ts';
import type { JwtPayload, ProviderProfile } from '../../../types/src/index.ts';

export class RadiusApp {
  public server: http.Server;
  private bookingService = new BookingService();
  private pricingService = new PricingService();
  private quoteService = new QuoteService(this.bookingService, this.pricingService);

  constructor() {
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  private async parseJsonBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 5 * 1024 * 1024) {
          reject(new Error('Payload too large'));
        }
      });
      req.on('end', () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: any) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(JSON.stringify(data));
  }

  private authenticate(req: http.IncomingMessage): JwtPayload | null {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.substring(7);
    try {
      return AuthService.verifyToken(token);
    } catch {
      return null;
    }
  }

  public async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    try {
      if (pathname === '/health' && method === 'GET') {
        return this.sendJson(res, 200, { status: 'ok', service: 'radius-backend', timestamp: new Date().toISOString() });
      }

      // --- AUTH ENDPOINTS ---
      if (pathname === '/api/v1/auth/otp/send' && method === 'POST') {
        const body = await this.parseJsonBody(req);
        if (!body.destination) {
          return this.sendJson(res, 400, { error: 'destination is required' });
        }
        const result = AuthService.sendOtp(body.destination);
        return this.sendJson(res, 200, result);
      }

      if (pathname === '/api/v1/auth/otp/verify' && method === 'POST') {
        const body = await this.parseJsonBody(req);
        if (!body.destination || !body.code) {
          return this.sendJson(res, 400, { error: 'destination and code are required' });
        }
        const tokens = AuthService.verifyOtp(body.destination, body.code, body.name, body.role);
        return this.sendJson(res, 200, tokens);
      }

      if (pathname === '/api/v1/auth/refresh' && method === 'POST') {
        const body = await this.parseJsonBody(req);
        if (!body.refreshToken) {
          return this.sendJson(res, 400, { error: 'refreshToken is required' });
        }
        const result = AuthService.refreshAccessToken(body.refreshToken);
        return this.sendJson(res, 200, result);
      }

      if (pathname === '/api/v1/auth/me' && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });
        const user = db.users.get(userPayload.sub);
        if (!user) return this.sendJson(res, 404, { error: 'User not found' });
        return this.sendJson(res, 200, { user });
      }

      if (pathname === '/api/v1/users/push-token' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });
        const body = await this.parseJsonBody(req);
        const user = db.users.get(userPayload.sub);
        if (user && body.expoPushToken) {
          user.expoPushToken = body.expoPushToken;
          db.users.set(user.id, user);
        }
        return this.sendJson(res, 200, { success: true });
      }

      // --- CATEGORIES ---
      if (pathname === '/api/v1/categories' && method === 'GET') {
        const uniqueCategories = Array.from(new Set(db.categories.values()));
        return this.sendJson(res, 200, { categories: uniqueCategories });
      }

      // --- PROVIDER DISCOVERY & SEARCH ---
      if (pathname === '/api/v1/providers/profile' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const body = await this.parseJsonBody(req);
        const existing = Array.from(db.providerProfiles.values()).find((p) => p.userId === userPayload.sub);

        const profile: ProviderProfile = {
          id: existing?.id || `prov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          userId: userPayload.sub,
          bio: body.bio || '',
          categories: body.categories || [],
          serviceRadiusKm: body.serviceRadiusKm || 10,
          workingHours: body.workingHours || {},
          licenses: body.licenses || [],
          verificationStatus: existing?.verificationStatus || 'PENDING',
          ratingAvg: existing?.ratingAvg || 0.0,
          ratingCount: existing?.ratingCount || 0,
          isFeatured: existing?.isFeatured || false,
          subscriptionPlan: existing?.subscriptionPlan || 'PRO_BASIC',
          location: body.location || { latitude: 37.7749, longitude: -122.4194 },
          approxZone: GeospatialService.computeApproximateZone(
            body.location || { latitude: 37.7749, longitude: -122.4194 }
          ),
        };

        db.providerProfiles.set(profile.id, profile);
        return this.sendJson(res, 200, { profile });
      }

      if (pathname === '/api/v1/providers/search' && method === 'GET') {
        const lat = parseFloat(parsedUrl.searchParams.get('lat') || '0');
        const lng = parseFloat(parsedUrl.searchParams.get('lng') || '0');
        const radiusKm = Math.min(50, Math.max(1, parseFloat(parsedUrl.searchParams.get('radiusKm') || '10')));
        const categorySlug = parsedUrl.searchParams.get('category') || undefined;
        const verifiedOnly = parsedUrl.searchParams.get('verifiedOnly') !== 'false';
        const minRating = parsedUrl.searchParams.get('minRating')
          ? parseFloat(parsedUrl.searchParams.get('minRating')!)
          : undefined;

        const cacheKey = GeoCacheService.makeKey({
          latitude: lat,
          longitude: lng,
          radiusKm,
          categorySlug,
          verifiedOnly,
          minRating,
        });

        let results = geoCache.get<Array<{ provider: ProviderProfile; distanceKm: number; searchRankScore: number }>>(
          cacheKey
        );

        if (!results) {
          results = db.findProvidersInRadius({
            latitude: lat,
            longitude: lng,
            radiusKm,
            categorySlug,
            verifiedOnly,
            minRating,
          });
          geoCache.set(cacheKey, results);
        }

        const withPromotions = PromotionsService.injectPromotedListings(results, { categorySlug });

        const maskedResults = withPromotions.map((r) => {
          const providerUser = db.users.get(r.provider.userId);
          const sanitizedProvider = GeospatialService.maskProviderForSearch(
            { ...r.provider, user: providerUser },
            false
          );
          return {
            provider: sanitizedProvider,
            distanceKm: r.distanceKm,
            searchRankScore: r.searchRankScore,
            isSponsored: r.isSponsored || false,
          };
        });

        return this.sendJson(res, 200, { results: maskedResults });
      }

      if (pathname.startsWith('/api/v1/providers/') && method === 'GET') {
        const providerId = pathname.replace('/api/v1/providers/', '');
        const provider = db.providerProfiles.get(providerId);
        if (!provider) return this.sendJson(res, 404, { error: 'Provider not found' });

        const userPayload = this.authenticate(req);
        let isConfirmed = false;
        if (userPayload) {
          if (userPayload.role === 'ADMIN' || provider.userId === userPayload.sub) {
            isConfirmed = true;
          } else {
            for (const b of db.bookings.values()) {
              if (
                b.providerId === provider.id &&
                b.requesterId === userPayload.sub &&
                ['BOOKED', 'IN_PROGRESS', 'COMPLETED', 'PAID_OUT'].includes(b.status)
              ) {
                isConfirmed = true;
                break;
              }
            }
          }
        }

        const providerUser = db.users.get(provider.userId);
        const masked = GeospatialService.maskProviderForSearch(
          { ...provider, user: providerUser },
          isConfirmed
        );

        return this.sendJson(res, 200, { provider: masked });
      }

      if (pathname === '/api/v1/providers/license/upload-url' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const presigned = StorageService.getPresignedUploadUrl(userPayload.sub, 'LICENSE');
        return this.sendJson(res, 200, presigned);
      }

      // --- JOB REQUESTS & QUOTING ---
      if (pathname === '/api/v1/jobs' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const body = await this.parseJsonBody(req);
        const isUrgent = Boolean(body.isUrgent);

        const job = {
          id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          requesterId: userPayload.sub,
          categoryId: body.categoryId,
          description: body.description,
          photos: body.photos || [],
          location: body.location || { latitude: 37.7749, longitude: -122.4194 },
          exactAddress: body.exactAddress || '123 Market St',
          preferredTime: body.preferredTime,
          isUrgent,
          status: 'REQUESTED' as const,
          quotesCount: 0,
          createdAt: new Date().toISOString(),
        };

        db.jobRequests.set(job.id, job);

        // Notify nearby providers via push with urgent prioritization
        const category = db.categories.get(job.categoryId);
        const providersInRadius = db.findProvidersInRadius({
          latitude: job.location.latitude,
          longitude: job.location.longitude,
          radiusKm: 25,
          categorySlug: category?.slug,
          verifiedOnly: true,
        });

        for (const p of providersInRadius) {
          const pUser = db.users.get(p.provider.userId);
          if (pUser?.expoPushToken) {
            ExpoPushService.sendPushNotification({
              to: pUser.expoPushToken,
              title: isUrgent ? '🚨 URGENT: New Service Request Nearby' : 'New Job Request Nearby',
              body: `${category?.name || 'Service'}: ${job.description.substring(0, 60)}... (${p.distanceKm} km away)`,
              priority: isUrgent ? 'high' : 'normal',
              data: { jobRequestId: job.id, isUrgent },
            });
          }
        }

        return this.sendJson(res, 201, { job });
      }

      if (pathname === '/api/v1/quotes' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const body = await this.parseJsonBody(req);
        const provider = Array.from(db.providerProfiles.values()).find((p) => p.userId === userPayload.sub);
        if (!provider) return this.sendJson(res, 403, { error: 'Only registered providers can quote' });

        const quote = this.quoteService.submitQuote({
          jobRequestId: body.jobRequestId,
          providerId: provider.id,
          amount: body.amount,
          currency: body.currency,
          note: body.note,
        });

        return this.sendJson(res, 201, { quote });
      }

      if (pathname.match(/^\/api\/v1\/jobs\/[^/]+\/quotes$/) && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const jobRequestId = pathname.split('/')[4];
        const quotes = this.quoteService.getQuotesForJob(jobRequestId, userPayload.sub);
        return this.sendJson(res, 200, { quotes });
      }

      if (pathname.match(/^\/api\/v1\/quotes\/[^/]+\/accept$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const quoteId = pathname.split('/')[4];
        const body = await this.parseJsonBody(req);
        const result = this.quoteService.acceptQuote({
          quoteId,
          requesterId: userPayload.sub,
          scheduledAt: body.scheduledAt,
        });

        return this.sendJson(res, 200, result);
      }

      // --- SUBSCRIPTIONS & STRIPE BILLING ---
      if (pathname === '/api/v1/subscriptions' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const body = await this.parseJsonBody(req);
        const sub = SubscriptionService.setSubscription({
          userId: userPayload.sub,
          plan: body.plan, // 'RADIUS_PLUS' or 'PRO_PLUS'
          status: 'ACTIVE',
        });
        return this.sendJson(res, 200, { subscription: sub });
      }

      if (pathname === '/api/v1/subscriptions/me' && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const sub = SubscriptionService.getSubscription(userPayload.sub);
        return this.sendJson(res, 200, { subscription: sub || null });
      }

      if (pathname === '/api/v1/webhooks/stripe' && method === 'POST') {
        const event = await this.parseJsonBody(req);
        const result = SubscriptionService.handleStripeWebhook(event);
        return this.sendJson(res, 200, result);
      }

      // --- BOOKINGS & ESCROW ---
      if (pathname === '/api/v1/bookings/instant' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const body = await this.parseJsonBody(req);
        const { booking, payment } = this.bookingService.createInstantBooking({
          jobRequestId: body.jobRequestId,
          providerId: body.providerId,
          requesterId: userPayload.sub,
          agreedAmount: body.agreedAmount,
          currency: body.currency,
          scheduledAt: body.scheduledAt,
          isUrgent: body.isUrgent,
          isUrgentEligible: body.isUrgentEligible,
        });

        return this.sendJson(res, 201, { booking, payment });
      }

      if (pathname === '/api/v1/bookings' && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const userBookings: any[] = [];
        for (const b of db.bookings.values()) {
          const provider = db.providerProfiles.get(b.providerId);
          if (
            b.requesterId === userPayload.sub ||
            provider?.userId === userPayload.sub ||
            userPayload.role === 'ADMIN'
          ) {
            const payment = this.bookingService.getBookingPayment(b.id);
            userBookings.push({ ...b, payment });
          }
        }
        return this.sendJson(res, 200, { bookings: userBookings });
      }

      if (pathname.startsWith('/api/v1/bookings/') && method === 'GET') {
        const bookingId = pathname.replace('/api/v1/bookings/', '');
        const booking = db.bookings.get(bookingId);
        if (!booking) return this.sendJson(res, 404, { error: 'Booking not found' });

        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const provider = db.providerProfiles.get(booking.providerId);
        const isAuthorized =
          booking.requesterId === userPayload.sub ||
          provider?.userId === userPayload.sub ||
          userPayload.role === 'ADMIN';

        if (!isAuthorized) {
          return this.sendJson(res, 403, { error: 'Forbidden' });
        }

        const payment = this.bookingService.getBookingPayment(booking.id);
        const requesterUser = db.users.get(booking.requesterId);
        const providerUser = provider ? db.users.get(provider.userId) : undefined;

        return this.sendJson(res, 200, {
          booking: {
            ...booking,
            payment,
            requester: requesterUser,
            provider: {
              ...provider,
              user: providerUser,
            },
          },
        });
      }

      if (pathname.match(/^\/api\/v1\/bookings\/[^/]+\/start$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const bookingId = pathname.split('/')[4];
        const updated = this.bookingService.transitionBooking(bookingId, 'IN_PROGRESS', {
          actorId: userPayload.sub,
          actorRole: userPayload.role,
        });
        return this.sendJson(res, 200, { booking: updated });
      }

      if (pathname.match(/^\/api\/v1\/bookings\/[^/]+\/complete$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const bookingId = pathname.split('/')[4];
        const updated = this.bookingService.transitionBooking(bookingId, 'COMPLETED', {
          actorId: userPayload.sub,
          actorRole: userPayload.role,
        });
        return this.sendJson(res, 200, { booking: updated });
      }

      if (pathname.match(/^\/api\/v1\/bookings\/[^/]+\/confirm$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const bookingId = pathname.split('/')[4];
        const updated = this.bookingService.transitionBooking(bookingId, 'PAID_OUT', {
          actorId: userPayload.sub,
          actorRole: userPayload.role,
        });
        return this.sendJson(res, 200, { booking: updated });
      }

      if (pathname.match(/^\/api\/v1\/bookings\/[^/]+\/cancel$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const bookingId = pathname.split('/')[4];
        const body = await this.parseJsonBody(req);
        const updated = this.bookingService.transitionBooking(bookingId, 'CANCELLED', {
          actorId: userPayload.sub,
          actorRole: userPayload.role,
          reason: body.reason,
        });
        return this.sendJson(res, 200, { booking: updated });
      }

      if (pathname.match(/^\/api\/v1\/bookings\/[^/]+\/dispute$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const bookingId = pathname.split('/')[4];
        const body = await this.parseJsonBody(req);
        const dispute = DisputeService.openDispute({
          bookingId,
          openedBy: userPayload.sub,
          reason: body.reason || 'POOR_QUALITY',
          evidence: body.evidence,
        });
        return this.sendJson(res, 201, { dispute });
      }

      if (pathname.match(/^\/api\/v1\/disputes\/[^/]+\/evidence$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const disputeId = pathname.split('/')[4];
        const body = await this.parseJsonBody(req);
        const evidence = DisputeService.addEvidence({
          disputeId,
          uploaderId: userPayload.sub,
          fileKey: body.fileKey,
          fileUrl: body.fileUrl,
          description: body.description,
        });
        return this.sendJson(res, 201, { evidence });
      }

      // --- REVIEWS & ANTI-SPAM AGGREGATION ---
      if (pathname === '/api/v1/reviews' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const body = await this.parseJsonBody(req);
        const review = ReviewService.createReview({
          bookingId: body.bookingId,
          reviewerId: userPayload.sub,
          targetUserId: body.targetUserId,
          rating: body.rating,
          comment: body.comment,
        });

        // Run anti-spam aggregation job
        RatingAggregationService.runAggregationJob();

        return this.sendJson(res, 201, { review });
      }

      if (pathname === '/api/v1/admin/ratings/aggregate' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const result = RatingAggregationService.runAggregationJob();
        return this.sendJson(res, 200, result);
      }

      // --- CHAT & REALTIME SYNC ---
      if (pathname === '/api/v1/messages' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const body = await this.parseJsonBody(req);
        const message = MessageService.sendMessage({
          bookingId: body.bookingId,
          senderId: userPayload.sub,
          body: body.body,
        });
        return this.sendJson(res, 201, { message });
      }

      if (pathname.startsWith('/api/v1/messages/') && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const bookingId = pathname.replace('/api/v1/messages/', '');
        const since = parsedUrl.searchParams.get('since') || undefined;
        const messages = MessageService.getBookingMessages(bookingId, userPayload.sub, since);
        return this.sendJson(res, 200, { messages });
      }

      // --- ADMIN DASHBOARD ENDPOINTS ---
      if (pathname === '/api/v1/admin/verifications' && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const queue = AdminService.getVerificationQueue();
        return this.sendJson(res, 200, { queue });
      }

      if (pathname.match(/^\/api\/v1\/admin\/verifications\/[^/]+\/approve$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const providerId = pathname.split('/')[5];
        const approved = AdminService.approveProvider(providerId, userPayload.sub);
        return this.sendJson(res, 200, { provider: approved });
      }

      if (pathname.match(/^\/api\/v1\/admin\/verifications\/[^/]+\/reject$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const providerId = pathname.split('/')[5];
        const body = await this.parseJsonBody(req);
        const rejected = AdminService.rejectProvider(providerId, userPayload.sub, body.reason || 'Verification rejected');
        return this.sendJson(res, 200, { provider: rejected });
      }

      if (pathname === '/api/v1/admin/disputes' && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const disputes = DisputeService.getDisputesWithSla();
        return this.sendJson(res, 200, { disputes });
      }

      if (pathname.match(/^\/api\/v1\/admin\/disputes\/[^/]+\/resolve$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const disputeId = pathname.split('/')[5];
        const body = await this.parseJsonBody(req);
        const resolved = DisputeService.resolveDispute({
          disputeId,
          adminId: userPayload.sub,
          resolution: body.resolution,
          notes: body.notes || 'Admin dispute resolution',
        });
        return this.sendJson(res, 200, { dispute: resolved });
      }

      if (pathname === '/api/v1/admin/stats' && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const stats = AdminService.getStats();
        return this.sendJson(res, 200, { stats });
      }

      // --- MULTI-CITY REGISTRY ---
      if (pathname === '/api/v1/cities' && method === 'GET') {
        const cities = CityService.listCities();
        return this.sendJson(res, 200, { cities });
      }

      if (pathname === '/api/v1/admin/cities' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const body = await this.parseJsonBody(req);
        const city = CityService.registerCity(body);
        return this.sendJson(res, 201, { city });
      }

      // --- PROMOTED LISTINGS (SPONSORED SEARCH ADS) ---
      if (pathname === '/api/v1/promotions' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'PROVIDER') return this.sendJson(res, 403, { error: 'Providers only' });

        const body = await this.parseJsonBody(req);
        const provider = Array.from(db.providerProfiles.values()).find((p) => p.userId === userPayload.sub);
        if (!provider) return this.sendJson(res, 404, { error: 'Provider profile not found' });

        const campaign = PromotionsService.createCampaign({
          providerId: provider.id,
          citySlug: body.citySlug || 'san-francisco',
          categorySlug: body.categorySlug,
          bidCpcCents: body.bidCpcCents || 150,
          dailyBudgetCents: body.dailyBudgetCents || 2000,
        });
        return this.sendJson(res, 201, { campaign });
      }

      if (pathname.match(/^\/api\/v1\/promotions\/[^/]+\/click$/) && method === 'POST') {
        const campaignId = pathname.split('/')[4];
        const record = PromotionsService.recordClick(campaignId);
        return this.sendJson(res, 200, { record });
      }

      if (pathname === '/api/v1/admin/promotions/billing' && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const records = PromotionsService.getBillingRecords();
        return this.sendJson(res, 200, { records });
      }

      // --- BUSINESS ACCOUNTS & RECURRING JOBS ---
      if (pathname === '/api/v1/business' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const body = await this.parseJsonBody(req);
        const account = BusinessService.createBusinessAccount({
          companyName: body.companyName,
          ownerUserId: userPayload.sub,
          billingEmail: body.billingEmail || userPayload.email || 'billing@example.com',
          taxId: body.taxId,
        });
        return this.sendJson(res, 201, { account });
      }

      if (pathname.match(/^\/api\/v1\/business\/[^/]+\/members$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const businessAccountId = pathname.split('/')[4];
        const body = await this.parseJsonBody(req);
        const member = BusinessService.addMember({
          businessAccountId,
          name: body.name,
          email: body.email,
          role: body.role || 'MEMBER',
          requesterUserId: userPayload.sub,
        });
        return this.sendJson(res, 201, { member });
      }

      if (pathname.match(/^\/api\/v1\/business\/[^/]+\/recurring-templates$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const businessAccountId = pathname.split('/')[4];
        const body = await this.parseJsonBody(req);
        const template = BusinessService.createRecurringTemplate({
          businessAccountId,
          categoryId: body.categoryId,
          title: body.title,
          description: body.description,
          frequency: body.frequency || 'MONTHLY',
          location: body.location,
          exactAddress: body.exactAddress,
          budgetCapCents: body.budgetCapCents || 50000,
          preferredProviderId: body.preferredProviderId,
          requesterUserId: userPayload.sub,
        });
        return this.sendJson(res, 201, { template });
      }

      if (pathname.match(/^\/api\/v1\/business\/[^/]+\/invoices$/) && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const businessAccountId = pathname.split('/')[4];
        const invoices = BusinessService.getInvoices(businessAccountId);
        return this.sendJson(res, 200, { invoices });
      }

      if (pathname.match(/^\/api\/v1\/business\/[^/]+\/invoices\/generate$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const businessAccountId = pathname.split('/')[4];
        const body = await this.parseJsonBody(req);
        const invoice = BusinessService.generateMonthlyInvoice({
          businessAccountId,
          periodStart: body.periodStart || new Date(Date.now() - 30 * 86400000).toISOString(),
          periodEnd: body.periodEnd || new Date().toISOString(),
          currency: body.currency || 'USD',
        });
        return this.sendJson(res, 201, { invoice });
      }

      // --- LEAD CREDITS MARKETPLACE ---
      if (pathname === '/api/v1/credits/packages' && method === 'GET') {
        return this.sendJson(res, 200, {
          packages: LeadCreditsService.PACKAGES,
          enabled: LeadCreditsService.isEnabled(),
        });
      }

      if (pathname === '/api/v1/credits/purchase' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'PROVIDER') return this.sendJson(res, 403, { error: 'Providers only' });

        const body = await this.parseJsonBody(req);
        const provider = Array.from(db.providerProfiles.values()).find((p) => p.userId === userPayload.sub);
        if (!provider) return this.sendJson(res, 404, { error: 'Provider profile not found' });

        const transaction = LeadCreditsService.purchasePackage(provider.id, body.packageId);
        return this.sendJson(res, 200, { transaction });
      }

      if (pathname === '/api/v1/credits/unlock' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'PROVIDER') return this.sendJson(res, 403, { error: 'Providers only' });

        const body = await this.parseJsonBody(req);
        const provider = Array.from(db.providerProfiles.values()).find((p) => p.userId === userPayload.sub);
        if (!provider) return this.sendJson(res, 404, { error: 'Provider profile not found' });

        const transaction = LeadCreditsService.unlockJob(provider.id, body.jobRequestId, body.costCredits || 2);
        return this.sendJson(res, 200, { transaction });
      }

      // --- INSURANCE & DAMAGE PROTECTION ---
      if (pathname === '/api/v1/insurance/plan' && method === 'GET') {
        const plan = InsuranceService.getPlan();
        return this.sendJson(res, 200, { plan });
      }

      if (pathname === '/api/v1/insurance/claims' && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload) return this.sendJson(res, 401, { error: 'Unauthorized' });

        const body = await this.parseJsonBody(req);
        const claim = InsuranceService.fileClaim({
          bookingId: body.bookingId,
          claimantId: userPayload.sub,
          amountRequestedCents: body.amountRequestedCents,
          description: body.description,
          photos: body.photos || [],
        });
        return this.sendJson(res, 201, { claim });
      }

      if (pathname === '/api/v1/admin/insurance/claims' && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const claims = InsuranceService.listClaims();
        return this.sendJson(res, 200, { claims });
      }

      if (pathname.match(/^\/api\/v1\/admin\/insurance\/claims\/[^/]+\/resolve$/) && method === 'POST') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const claimId = pathname.split('/')[5];
        const body = await this.parseJsonBody(req);
        const claim = InsuranceService.reviewClaim({
          claimId,
          adminUserId: userPayload.sub,
          status: body.status,
          amountApprovedCents: body.amountApprovedCents,
          resolutionNotes: body.resolutionNotes,
        });
        return this.sendJson(res, 200, { claim });
      }

      // --- ANALYTICS & FINANCIAL RECONCILIATION ---
      if (pathname === '/api/v1/admin/analytics/funnel' && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const funnel = AnalyticsService.getFunnelMetrics();
        return this.sendJson(res, 200, { funnel });
      }

      if (pathname === '/api/v1/admin/analytics/liquidity' && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const citySlug = parsedUrl.searchParams.get('city') || undefined;
        const liquidity = AnalyticsService.getZoneLiquidity(citySlug);
        return this.sendJson(res, 200, { liquidity });
      }

      if (pathname === '/api/v1/admin/analytics/reconciliation' && method === 'GET') {
        const userPayload = this.authenticate(req);
        if (!userPayload || userPayload.role !== 'ADMIN') return this.sendJson(res, 403, { error: 'Admin only' });

        const reconciliation = AnalyticsService.reconcileFinancials();
        return this.sendJson(res, 200, { reconciliation });
      }

      return this.sendJson(res, 404, { error: 'Endpoint not found', path: pathname });
    } catch (err: any) {
      console.error('Unhandled request error:', err);
      return this.sendJson(res, 400, { error: err.message || 'Bad Request' });
    }
  }

  public listen(port: number, callback?: () => void): http.Server {
    return this.server.listen(port, callback);
  }

  public close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}

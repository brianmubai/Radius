import type { Review } from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';

export class ReviewService {
  public static createReview(params: {
    bookingId: string;
    reviewerId: string;
    targetUserId: string;
    rating: number;
    comment: string;
  }): Review {
    const { bookingId, reviewerId, targetUserId, rating, comment } = params;

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      throw new Error('Rating must be an integer between 1 and 5');
    }

    if (!comment || comment.trim().length === 0) {
      throw new Error('Review comment cannot be empty');
    }

    const booking = db.bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (booking.status !== 'COMPLETED' && booking.status !== 'PAID_OUT') {
      throw new Error(
        `Reviews are only permitted for completed or paid bookings (current status: ${booking.status})`
      );
    }

    const isRequester = booking.requesterId === reviewerId;
    const provider = db.providerProfiles.get(booking.providerId);
    const isProvider = provider && provider.userId === reviewerId;

    if (!isRequester && !isProvider) {
      throw new Error('You are not authorized to review this booking');
    }

    for (const r of db.reviews.values()) {
      if (r.bookingId === bookingId && r.reviewerId === reviewerId) {
        throw new Error('You have already submitted a review for this booking');
      }
    }

    const review: Review = {
      id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookingId,
      reviewerId,
      targetUserId,
      rating,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
    };

    db.reviews.set(review.id, review);

    if (provider && provider.userId === targetUserId) {
      const allProviderReviews: Review[] = [];
      for (const r of db.reviews.values()) {
        if (r.targetUserId === targetUserId) {
          allProviderReviews.push(r);
        }
      }

      const totalRating = allProviderReviews.reduce((sum, r) => sum + r.rating, 0);
      provider.ratingCount = allProviderReviews.length;
      provider.ratingAvg =
        Math.round((totalRating / allProviderReviews.length) * 100) / 100;

      db.providerProfiles.set(provider.id, provider);
    }

    db.logAudit('REVIEW_CREATED', 'BOOKING', booking.id, reviewerId, {
      reviewId: review.id,
      rating,
      targetUserId,
    });

    return review;
  }

  public static getReviewsForUser(userId: string): Review[] {
    const list: Review[] = [];
    for (const r of db.reviews.values()) {
      if (r.targetUserId === userId) {
        list.push(r);
      }
    }
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

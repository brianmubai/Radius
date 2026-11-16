import type { Review } from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';

export class RatingAggregationService {
  /**
   * Scans all reviews, detects review spam / collusive account pairs,
   * flags spam reviews, and recalculates ratingAvg and ratingCount for all providers.
   */
  public static runAggregationJob(): {
    processedReviewsCount: number;
    flaggedSpamCount: number;
    updatedProvidersCount: number;
  } {
    let flaggedSpamCount = 0;
    let updatedProvidersCount = 0;

    // 1. Detect Collusive / Repeated Account Pairs
    // Map of "reviewerId:targetUserId" -> list of reviews
    const pairReviewMap: Map<string, Review[]> = new Map();

    for (const review of db.reviews.values()) {
      const pairKey = `${review.reviewerId}:${review.targetUserId}`;
      if (!pairReviewMap.has(pairKey)) {
        pairReviewMap.set(pairKey, []);
      }
      pairReviewMap.get(pairKey)!.push(review);
    }

    for (const [pairKey, reviews] of pairReviewMap.entries()) {
      // Sort reviews chronologically
      reviews.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // If more than 1 review exists between the same account pair, subsequent reviews are flagged as spam
      if (reviews.length > 1) {
        for (let i = 1; i < reviews.length; i++) {
          const rev = reviews[i];
          if (!rev.isFlaggedSpam) {
            rev.isFlaggedSpam = true;
            rev.spamReason = 'SUSPICIOUS_ACCOUNT_PAIR_COLLUSION';
            db.reviews.set(rev.id, rev);
            flaggedSpamCount++;

            db.logAudit('REVIEW_FLAGGED_SPAM', 'BOOKING', rev.bookingId, 'anti-spam-engine', {
              reviewId: rev.id,
              reviewerId: rev.reviewerId,
              targetUserId: rev.targetUserId,
              reason: rev.spamReason,
            });
          }
        }
      }
    }

    // 2. Recalculate ratingAvg and ratingCount for each provider using ONLY verified, non-spam reviews
    for (const provider of db.providerProfiles.values()) {
      const validReviews: Review[] = [];

      for (const r of db.reviews.values()) {
        if (r.targetUserId === provider.userId && !r.isFlaggedSpam) {
          validReviews.push(r);
        }
      }

      if (validReviews.length === 0) {
        provider.ratingAvg = 0.0;
        provider.ratingCount = 0;
      } else {
        const sum = validReviews.reduce((acc, r) => acc + r.rating, 0);
        provider.ratingCount = validReviews.length;
        provider.ratingAvg = Math.round((sum / validReviews.length) * 100) / 100;
      }

      db.providerProfiles.set(provider.id, provider);
      updatedProvidersCount++;
    }

    return {
      processedReviewsCount: db.reviews.size,
      flaggedSpamCount,
      updatedProvidersCount,
    };
  }
}

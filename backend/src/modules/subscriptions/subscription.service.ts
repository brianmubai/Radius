import type {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';

export class SubscriptionService {
  // Idempotency tracking set for Stripe Webhooks
  private static processedEvents: Set<string> = new Set();

  public static clearProcessedEvents(): void {
    this.processedEvents.clear();
  }

  /**
   * Activates or updates a user/provider subscription.
   */
  public static setSubscription(params: {
    userId: string;
    plan: SubscriptionPlan;
    status?: SubscriptionStatus;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    renewsAt?: string;
  }): Subscription {
    const {
      userId,
      plan,
      status = 'ACTIVE',
      stripeSubscriptionId,
      stripeCustomerId,
      renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    } = params;

    const user = db.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Update user entity
    user.subscriptionPlan = plan;
    db.users.set(user.id, user);

    // If user is a provider, update their profile features
    for (const provider of db.providerProfiles.values()) {
      if (provider.userId === userId) {
        provider.subscriptionPlan = plan;
        provider.isFeatured = plan === 'PRO_PLUS';
        db.providerProfiles.set(provider.id, provider);
      }
    }

    // Update subscription record
    let subscription = db.subscriptions.get(userId);
    if (!subscription) {
      subscription = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId,
        stripeSubscriptionId,
        stripeCustomerId,
        plan,
        status,
        renewsAt,
        monthlyBookingsUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      subscription.plan = plan;
      subscription.status = status;
      if (stripeSubscriptionId) subscription.stripeSubscriptionId = stripeSubscriptionId;
      if (stripeCustomerId) subscription.stripeCustomerId = stripeCustomerId;
      subscription.renewsAt = renewsAt;
      subscription.updatedAt = new Date().toISOString();
    }

    db.subscriptions.set(userId, subscription);

    db.logAudit('SUBSCRIPTION_UPDATED', 'SUBSCRIPTION', subscription.id, userId, {
      plan,
      status,
      stripeSubscriptionId,
    });

    return subscription;
  }

  /**
   * Idempotent Stripe Webhook processor.
   * Ensures that duplicate webhook deliveries do not corrupt state.
   */
  public static handleStripeWebhook(event: {
    id: string;
    type: string;
    data: {
      object: Record<string, any>;
    };
  }): { success: boolean; duplicate: boolean; action: string } {
    const { id: eventId, type: eventType, data } = event;

    // Idempotency check
    if (this.processedEvents.has(eventId)) {
      return {
        success: true,
        duplicate: true,
        action: 'SKIPPED_DUPLICATE_EVENT',
      };
    }

    const obj = data.object;
    let actionTaken = 'IGNORED';

    switch (eventType) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const userId = obj.metadata?.userId || obj.client_reference_id;
        const plan = (obj.metadata?.plan as SubscriptionPlan) || 'PRO_PLUS';
        const status: SubscriptionStatus =
          obj.status === 'active' ? 'ACTIVE' : obj.status === 'past_due' ? 'PAST_DUE' : 'CANCELLED';

        if (userId) {
          this.setSubscription({
            userId,
            plan,
            status,
            stripeSubscriptionId: obj.id,
            stripeCustomerId: obj.customer,
            renewsAt: obj.current_period_end
              ? new Date(obj.current_period_end * 1000).toISOString()
              : undefined,
          });
          actionTaken = 'SUBSCRIPTION_APPLIED';
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const userId = obj.metadata?.userId || obj.client_reference_id;
        if (userId) {
          // Downgrade provider to PRO_BASIC, or remove Radius Plus
          const user = db.users.get(userId);
          const defaultPlan: SubscriptionPlan = user?.role === 'PROVIDER' ? 'PRO_BASIC' : 'PRO_BASIC';
          this.setSubscription({
            userId,
            plan: defaultPlan,
            status: 'CANCELLED',
            stripeSubscriptionId: obj.id,
          });
          actionTaken = 'SUBSCRIPTION_CANCELLED';
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Reset monthly booking counter on billing cycle renewal
        const subscriptionId = obj.subscription;
        for (const sub of db.subscriptions.values()) {
          if (sub.stripeSubscriptionId === subscriptionId) {
            sub.monthlyBookingsUsed = 0;
            sub.updatedAt = new Date().toISOString();
            db.subscriptions.set(sub.userId, sub);
            actionTaken = 'USAGE_RESET';
            break;
          }
        }
        break;
      }
    }

    // Mark event as processed
    this.processedEvents.add(eventId);

    db.logAudit('STRIPE_WEBHOOK_PROCESSED', 'SUBSCRIPTION', eventId, 'stripe-webhook', {
      eventType,
      actionTaken,
    });

    return {
      success: true,
      duplicate: false,
      action: actionTaken,
    };
  }

  public static getSubscription(userId: string): Subscription | undefined {
    return db.subscriptions.get(userId);
  }
}

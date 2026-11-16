import type { PushNotificationPayload } from '../../../../types/src/index.ts';

export class ExpoPushService {
  public static dispatchedNotifications: PushNotificationPayload[] = [];

  public static clearHistory(): void {
    this.dispatchedNotifications = [];
  }

  /**
   * Sends a push notification to an Expo Push Token.
   * If priority is 'high', flags for urgent immediate delivery.
   */
  public static async sendPushNotification(
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; id: string }> {
    const notification: PushNotificationPayload = {
      ...payload,
      sound: payload.sound !== undefined ? payload.sound : 'default',
      priority: payload.priority || 'default',
    };

    // Store in internal history for testing and verification
    this.dispatchedNotifications.push(notification);

    const isTest = process.env.NODE_ENV === 'test' || !process.env.EXPO_ACCESS_TOKEN;

    if (isTest) {
      return { success: true, id: `mock-ticket-${Date.now()}` };
    }

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(notification),
      });

      const result = await response.json();
      return { success: true, id: result?.data?.id || 'live-ticket' };
    } catch (err) {
      console.error('Expo push dispatch failed:', err);
      return { success: false, id: 'error' };
    }
  }

  /**
   * Dispatches push notifications to multiple recipients in batch.
   */
  public static async sendBatchPushNotifications(
    payloads: PushNotificationPayload[]
  ): Promise<{ sentCount: number }> {
    for (const p of payloads) {
      await this.sendPushNotification(p);
    }
    return { sentCount: payloads.length };
  }
}

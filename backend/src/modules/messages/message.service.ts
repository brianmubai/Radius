import type { Message } from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';
import { SocketHub } from '../realtime/socket.hub.ts';
import { ExpoPushService } from '../notifications/push.service.ts';

export class MessageService {
  public static sendMessage(params: {
    bookingId: string;
    senderId: string;
    body: string;
  }): Message {
    const { bookingId, senderId, body } = params;

    if (!body || body.trim().length === 0) {
      throw new Error('Message body cannot be empty');
    }

    const booking = db.bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    const provider = db.providerProfiles.get(booking.providerId);
    const isRequester = booking.requesterId === senderId;
    const isProvider = provider && provider.userId === senderId;

    if (!isRequester && !isProvider) {
      const sender = db.users.get(senderId);
      if (!sender || sender.role !== 'ADMIN') {
        throw new Error('You are not authorized to message on this booking');
      }
    }

    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookingId,
      senderId,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };

    db.messages.set(message.id, message);

    // 1. Broadcast via WebSocket Hub to booking room
    SocketHub.emitToBookingRoom(bookingId, 'chat:message', { message });

    // 2. Dispatch push notification to recipient
    const recipientUserId = isRequester ? provider?.userId : booking.requesterId;
    if (recipientUserId) {
      const recipientUser = db.users.get(recipientUserId);
      if (recipientUser?.expoPushToken) {
        const sender = db.users.get(senderId);
        ExpoPushService.sendPushNotification({
          to: recipientUser.expoPushToken,
          title: `New message from ${sender?.name || 'Radius'}`,
          body: body.length > 80 ? `${body.substring(0, 80)}...` : body,
          data: { bookingId, messageId: message.id },
        });
      }
    }

    return message;
  }

  public static getBookingMessages(
    bookingId: string,
    viewerId: string,
    sinceTimestamp?: string
  ): Message[] {
    const booking = db.bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    const provider = db.providerProfiles.get(booking.providerId);
    const isRequester = booking.requesterId === viewerId;
    const isProvider = provider && provider.userId === viewerId;
    const viewer = db.users.get(viewerId);

    if (!isRequester && !isProvider && viewer?.role !== 'ADMIN') {
      throw new Error('You are not authorized to view messages for this booking');
    }

    const list: Message[] = [];
    for (const msg of db.messages.values()) {
      if (msg.bookingId === bookingId) {
        if (!sinceTimestamp || new Date(msg.createdAt).getTime() > new Date(sinceTimestamp).getTime()) {
          list.push(msg);
        }
      }
    }

    return list.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }
}

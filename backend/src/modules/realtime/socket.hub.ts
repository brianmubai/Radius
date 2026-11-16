import type { Message } from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';

type EventHandler = (data: any) => void;

export class SocketHub {
  private static userRooms: Map<string, Set<string>> = new Map();
  private static bookingRooms: Map<string, Set<string>> = new Map();
  private static socketSubscriptions: Map<string, Set<string>> = new Map();
  private static eventListeners: Map<string, Set<EventHandler>> = new Map();
  private static roomMessageBuffers: Map<string, Message[]> = new Map();

  public static reset(): void {
    this.userRooms.clear();
    this.bookingRooms.clear();
    this.socketSubscriptions.clear();
    this.eventListeners.clear();
    this.roomMessageBuffers.clear();
  }

  public static connectClient(socketId: string, userId?: string): void {
    this.socketSubscriptions.set(socketId, new Set());
    if (userId) {
      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }
      this.userRooms.get(userId)!.add(socketId);
    }
  }

  public static disconnectClient(socketId: string): void {
    const rooms = this.socketSubscriptions.get(socketId);
    if (rooms) {
      for (const room of rooms) {
        if (this.bookingRooms.has(room)) {
          this.bookingRooms.get(room)!.delete(socketId);
        }
      }
    }
    this.socketSubscriptions.delete(socketId);

    for (const [userId, sockets] of this.userRooms.entries()) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userRooms.delete(userId);
      }
    }
  }

  public static joinBookingRoom(
    socketId: string,
    bookingId: string,
    lastKnownMessageId?: string
  ): { activeParticipantsCount: number; missedMessages: Message[] } {
    if (!this.bookingRooms.has(bookingId)) {
      this.bookingRooms.set(bookingId, new Set());
    }
    this.bookingRooms.get(bookingId)!.add(socketId);

    if (!this.socketSubscriptions.has(socketId)) {
      this.socketSubscriptions.set(socketId, new Set());
    }
    this.socketSubscriptions.get(socketId)!.add(bookingId);

    const missedMessages = this.getMissedMessages(bookingId, lastKnownMessageId);

    return {
      activeParticipantsCount: this.bookingRooms.get(bookingId)!.size,
      missedMessages,
    };
  }

  public static emitToBookingRoom(bookingId: string, event: string, payload: any): void {
    if (event === 'chat:message' && payload.message) {
      if (!this.roomMessageBuffers.has(bookingId)) {
        this.roomMessageBuffers.set(bookingId, []);
      }
      this.roomMessageBuffers.get(bookingId)!.push(payload.message);
    }

    this.dispatch(event, { bookingId, ...payload });
  }

  public static broadcastToUser(userId: string, event: string, payload: any): void {
    this.dispatch(event, { targetUserId: userId, ...payload });
  }

  public static broadcastBookingStatusChange(bookingId: string, newStatus: string): void {
    this.emitToBookingRoom(bookingId, 'booking:status_changed', {
      bookingId,
      status: newStatus,
      timestamp: new Date().toISOString(),
    });
  }

  public static getMissedMessages(
    bookingId: string,
    lastKnownMessageId?: string
  ): Message[] {
    const list: Message[] = [];

    for (const msg of db.messages.values()) {
      if (msg.bookingId === bookingId) {
        list.push(msg);
      }
    }

    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (!lastKnownMessageId) {
      return list;
    }

    const idx = list.findIndex((m) => m.id === lastKnownMessageId);
    if (idx === -1) {
      return list;
    }

    return list.slice(idx + 1);
  }

  public static on(event: string, handler: EventHandler): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  public static off(event: string, handler: EventHandler): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(handler);
    }
  }

  private static dispatch(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const fn of listeners) {
        fn(data);
      }
    }
  }
}

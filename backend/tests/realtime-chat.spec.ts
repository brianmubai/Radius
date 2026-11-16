import { describe, it, expect, beforeEach } from './test-utils.ts';
import { SocketHub } from '../src/modules/realtime/socket.hub.ts';
import { MessageService } from '../src/modules/messages/message.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { Booking, ProviderProfile, User } from '../../../types/src/index.ts';

describe('RealTime WebSocket Hub & Reconnection Resilience', () => {
  beforeEach(() => {
    db.reset();
    SocketHub.reset();

    const req: User = {
      id: 'usr-chat-req',
      role: 'REQUESTER',
      name: 'Emma Requester',
      phone: '+14155551122',
      email: 'emma@example.com',
      locale: 'en',
      createdAt: new Date().toISOString(),
    };
    db.users.set(req.id, req);

    const provUser: User = {
      id: 'usr-chat-prov',
      role: 'PROVIDER',
      name: 'Dan Locksmith',
      phone: '+14155553344',
      email: 'dan@locksmith.com',
      locale: 'en',
      createdAt: new Date().toISOString(),
    };
    db.users.set(provUser.id, provUser);

    const provProfile: ProviderProfile = {
      id: 'prov-lock-1',
      userId: provUser.id,
      bio: '24/7 Locksmith',
      categories: ['locksmith'],
      serviceRadiusKm: 20,
      workingHours: {},
      licenses: [],
      verificationStatus: 'VERIFIED',
      ratingAvg: 4.9,
      ratingCount: 15,
      location: { latitude: 37.7749, longitude: -122.4194 },
      approxZone: {
        centerLatitude: 37.77,
        centerLongitude: -122.42,
        radiusMeters: 750,
        label: 'Zone',
      },
    };
    db.providerProfiles.set(provProfile.id, provProfile);

    const booking: Booking = {
      id: 'book-chat-test-01',
      jobRequestId: 'job-1',
      providerId: 'prov-lock-1',
      requesterId: 'usr-chat-req',
      agreedAmount: 12000,
      currency: 'USD',
      status: 'BOOKED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.bookings.set(booking.id, booking);
  });

  it('delivers chat message to room in under 2 seconds (<20ms in test environment)', async () => {
    const receivedMessages: any[] = [];
    const startTime = Date.now();

    const messageHandler = (data: any) => {
      receivedMessages.push(data);
    };
    SocketHub.on('chat:message', messageHandler);

    SocketHub.connectClient('sock-req-1', 'usr-chat-req');
    SocketHub.joinBookingRoom('sock-req-1', 'book-chat-test-01');

    const msg = MessageService.sendMessage({
      bookingId: 'book-chat-test-01',
      senderId: 'usr-chat-prov',
      body: 'I am outside the front door with lockpicks and replacement deadbolt.',
    });

    const elapsedMs = Date.now() - startTime;

    expect(elapsedMs).toBeLessThan(2000);
    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0].message.body).toBe(msg.body);
    expect(receivedMessages[0].bookingId).toBe('book-chat-test-01');

    SocketHub.off('chat:message', messageHandler);
  });

  it('guarantees zero message loss across client disconnect and reconnect', () => {
    SocketHub.connectClient('sock-client-a', 'usr-chat-req');
    SocketHub.joinBookingRoom('sock-client-a', 'book-chat-test-01');

    const msg1 = MessageService.sendMessage({
      bookingId: 'book-chat-test-01',
      senderId: 'usr-chat-prov',
      body: 'Message 1: On my way.',
    });

    const lastReceivedMessageId = msg1.id;

    // Client drops connection
    SocketHub.disconnectClient('sock-client-a');

    // While disconnected, Provider sends 2 new messages
    const msg2 = MessageService.sendMessage({
      bookingId: 'book-chat-test-01',
      senderId: 'usr-chat-prov',
      body: 'Message 2: Running into traffic on Market St.',
    });

    const msg3 = MessageService.sendMessage({
      bookingId: 'book-chat-test-01',
      senderId: 'usr-chat-prov',
      body: 'Message 3: Arriving in 2 minutes.',
    });

    // Reconnect with lastReceivedMessageId
    SocketHub.connectClient('sock-client-a-reconnected', 'usr-chat-req');
    const { missedMessages } = SocketHub.joinBookingRoom(
      'sock-client-a-reconnected',
      'book-chat-test-01',
      lastReceivedMessageId
    );

    expect(missedMessages.length).toBe(2);
    expect(missedMessages[0].id).toBe(msg2.id);
    expect(missedMessages[1].id).toBe(msg3.id);
    expect(missedMessages[0].body).toBe('Message 2: Running into traffic on Market St.');
    expect(missedMessages[1].body).toBe('Message 3: Arriving in 2 minutes.');
  });

  it('broadcasts live booking status changes to the room', () => {
    const statusEvents: any[] = [];
    const statusHandler = (data: any) => {
      statusEvents.push(data);
    };
    SocketHub.on('booking:status_changed', statusHandler);

    SocketHub.connectClient('sock-watch-1', 'usr-chat-req');
    SocketHub.joinBookingRoom('sock-watch-1', 'book-chat-test-01');

    SocketHub.broadcastBookingStatusChange('book-chat-test-01', 'IN_PROGRESS');
    SocketHub.broadcastBookingStatusChange('book-chat-test-01', 'COMPLETED');

    expect(statusEvents.length).toBe(2);
    expect(statusEvents[0].status).toBe('IN_PROGRESS');
    expect(statusEvents[1].status).toBe('COMPLETED');

    SocketHub.off('booking:status_changed', statusHandler);
  });
});

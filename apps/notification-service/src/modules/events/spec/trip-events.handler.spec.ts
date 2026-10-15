import { UserContact } from '@masr3/libs/auth';
import {
  TripActorEnum,
  TripStatusChangedEvent,
  TripStatusEnum,
  TripTypeEnum,
} from '@masr3/libs/kafka';

import AuthServiceClient from '../../../clients/auth-service.client';
import {
  NotificationTypeEnum,
  TripCancelledByEnum,
} from '../../notification/notification.enum';
import TripEventsHandler from '../trip-events.handler';

describe('TripEventsHandler', () => {
  let handler: TripEventsHandler;
  let authServiceClient: jest.Mocked<AuthServiceClient>;

  const customer: UserContact = {
    userId: 1,
    email: 'customer@masr3.local',
    firstName: 'Ahmed',
    lastName: 'Customer',
  };
  const driver: UserContact = {
    userId: 2,
    email: 'driver@masr3.local',
    firstName: 'Omar',
    lastName: 'Driver',
  };

  const event = (
    changes: Partial<TripStatusChangedEvent> = {},
  ): TripStatusChangedEvent => ({
    eventId: 'event-1',
    occurredAt: '2026-10-12T08:00:00.000Z',
    tripId: 7,
    type: TripTypeEnum.RIDE,
    customerId: 1,
    driverId: 2,
    fromStatus: TripStatusEnum.REQUESTED,
    toStatus: TripStatusEnum.ACCEPTED,
    actor: TripActorEnum.CUSTOMER,
    actorId: 1,
    reason: null,
    pickupAddress: 'Tahrir Square',
    dropoffAddress: 'Zamalek',
    proposedFare: 85,
    agreedFare: 95,
    currency: 'EGP',
    ...changes,
  });

  const route = {
    tripId: 7,
    pickupAddress: 'Tahrir Square',
    dropoffAddress: 'Zamalek',
  };

  beforeEach(() => {
    authServiceClient = {
      getUserContact: jest.fn(
        async (userId: number) => ({ 1: customer, 2: driver })[userId] ?? null,
      ),
    } as unknown as jest.Mocked<AuthServiceClient>;
    handler = new TripEventsHandler(authServiceClient);
  });

  it('accepted: confirms to the customer with the driver name, assigns to the driver', async () => {
    await expect(handler.handleStatusChanged(event())).resolves.toEqual([
      {
        type: NotificationTypeEnum.TRIP_CONFIRMED,
        userId: 1,
        dedupeKey: 'event-1:TRIP_CONFIRMED:1',
        data: {
          ...route,
          fare: 95,
          currency: 'EGP',
          driverName: 'Omar Driver',
        },
      },
      {
        type: NotificationTypeEnum.TRIP_ASSIGNED,
        userId: 2,
        dedupeKey: 'event-1:TRIP_ASSIGNED:2',
        data: {
          ...route,
          fare: 95,
          currency: 'EGP',
          customerFirstName: 'Ahmed',
        },
      },
    ]);
  });

  it('accepted: leaves out the name of someone auth-service no longer knows', async () => {
    authServiceClient.getUserContact.mockResolvedValue(null);

    const intents = await handler.handleStatusChanged(event());

    expect(intents.map((intent) => intent.data)).toEqual([
      expect.objectContaining({ driverName: null }),
      expect.objectContaining({ customerFirstName: null }),
    ]);
  });

  it('completed: a receipt for the customer with the agreed fare and the time', async () => {
    await expect(
      handler.handleStatusChanged(
        event({
          fromStatus: TripStatusEnum.IN_PROGRESS,
          toStatus: TripStatusEnum.COMPLETED,
        }),
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        type: NotificationTypeEnum.TRIP_RECEIPT,
        userId: 1,
        data: {
          ...route,
          fare: 95,
          currency: 'EGP',
          completedAt: '2026-10-12T08:00:00.000Z',
          driverName: 'Omar Driver',
        },
      }),
    ]);
  });

  describe('cancelled', () => {
    const cancelled = (actor: TripActorEnum, fromStatus: TripStatusEnum) =>
      event({
        toStatus: TripStatusEnum.CANCELLED,
        fromStatus,
        actor,
        reason: 'Changed plans',
      });

    it.each([
      [TripActorEnum.CUSTOMER, [2], TripCancelledByEnum.CUSTOMER],
      [TripActorEnum.DRIVER, [1], TripCancelledByEnum.DRIVER],
      [TripActorEnum.ADMIN, [1, 2], TripCancelledByEnum.SUPPORT],
    ])(
      'by %s after acceptance tells the other party',
      async (actor, userIds, cancelledBy) => {
        const intents = await handler.handleStatusChanged(
          cancelled(actor, TripStatusEnum.DRIVER_ARRIVED),
        );

        expect(intents.map((intent) => intent.userId)).toEqual(userIds);
        expect(intents[0]).toEqual(
          expect.objectContaining({
            type: NotificationTypeEnum.TRIP_CANCELLED,
            data: { ...route, cancelledBy, reason: 'Changed plans' },
          }),
        );
      },
    );

    it('before any driver accepted sends nothing', async () => {
      await expect(
        handler.handleStatusChanged(
          cancelled(TripActorEnum.CUSTOMER, TripStatusEnum.REQUESTED),
        ),
      ).resolves.toEqual([]);
    });
  });

  it('expired: tells the customer, with the fare they proposed', async () => {
    await expect(
      handler.handleStatusChanged(
        event({
          toStatus: TripStatusEnum.EXPIRED,
          driverId: null,
          actor: TripActorEnum.SYSTEM,
          agreedFare: null,
        }),
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        type: NotificationTypeEnum.TRIP_EXPIRED,
        userId: 1,
        data: { ...route, fare: 85, currency: 'EGP' },
      }),
    ]);
  });

  it.each([
    TripStatusEnum.REQUESTED,
    TripStatusEnum.DRIVER_ARRIVED,
    TripStatusEnum.IN_PROGRESS,
  ])('ignores a change to %s without any lookup', async (toStatus) => {
    await expect(
      handler.handleStatusChanged(event({ toStatus })),
    ).resolves.toEqual([]);
    expect(authServiceClient.getUserContact).not.toHaveBeenCalled();
  });

  it('rethrows when auth-service is down, so Kafka redelivers', async () => {
    authServiceClient.getUserContact.mockRejectedValue(
      new Error('auth-service unavailable'),
    );

    await expect(handler.handleStatusChanged(event())).rejects.toThrow(
      'auth-service unavailable',
    );
  });
});

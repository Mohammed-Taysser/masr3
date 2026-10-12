import { Injectable } from '@nestjs/common';

import {
  TripActorEnum,
  TripStatusChangedEvent,
  TripStatusEnum,
  UserContact,
} from '@masr3/libs';

import AuthServiceClient from '../../clients/auth-service.client';
import { NotificationTypeEnum } from '../notification/notification.enum';
import {
  NotificationDataMap,
  NotificationIntent,
} from '../notification/notification.interface';
import { CANCELLED_BY, TRIP_UNDER_WAY_STATUSES } from './events.constant';

// trip.status-changed → notification intents. The only lookup is the other
// party's name for display; recipients' contacts are the notifier's job.
@Injectable()
class TripEventsHandler {
  constructor(private readonly authServiceClient: AuthServiceClient) {}

  async handleStatusChanged(
    event: TripStatusChangedEvent,
  ): Promise<NotificationIntent[]> {
    switch (event.toStatus) {
      case TripStatusEnum.ACCEPTED:
        return this.accepted(event);
      case TripStatusEnum.COMPLETED:
        return this.completed(event);
      case TripStatusEnum.CANCELLED:
        return TripEventsHandler.cancelled(event);
      case TripStatusEnum.EXPIRED:
        return [
          TripEventsHandler.intent(
            event,
            NotificationTypeEnum.TRIP_EXPIRED,
            event.customerId,
            {
              ...TripEventsHandler.route(event),
              fare: event.proposedFare,
              currency: event.currency,
            },
          ),
        ];
      default:
        return [];
    }
  }

  private async accepted(
    event: TripStatusChangedEvent,
  ): Promise<NotificationIntent[]> {
    if (event.driverId === null) {
      return [];
    }

    const [customer, driver] = await this.contacts(event);
    const fare = event.agreedFare ?? event.proposedFare;

    return [
      TripEventsHandler.intent(
        event,
        NotificationTypeEnum.TRIP_CONFIRMED,
        event.customerId,
        {
          ...TripEventsHandler.route(event),
          fare,
          currency: event.currency,
          driverName: driver && TripEventsHandler.fullName(driver),
        },
      ),
      TripEventsHandler.intent(
        event,
        NotificationTypeEnum.TRIP_ASSIGNED,
        event.driverId,
        {
          ...TripEventsHandler.route(event),
          fare,
          currency: event.currency,
          customerFirstName: customer?.firstName ?? null,
        },
      ),
    ];
  }

  private async completed(
    event: TripStatusChangedEvent,
  ): Promise<NotificationIntent[]> {
    const [, driver] = await this.contacts(event);

    return [
      TripEventsHandler.intent(
        event,
        NotificationTypeEnum.TRIP_RECEIPT,
        event.customerId,
        {
          ...TripEventsHandler.route(event),
          fare: event.agreedFare ?? event.proposedFare,
          currency: event.currency,
          completedAt: event.occurredAt,
          driverName: driver && TripEventsHandler.fullName(driver),
        },
      ),
    ];
  }

  // Only a trip that had a driver on the way is worth telling the other party
  // about; whoever cancelled already knows.
  private static cancelled(
    event: TripStatusChangedEvent,
  ): NotificationIntent[] {
    const wasUnderWay =
      event.fromStatus !== null &&
      TRIP_UNDER_WAY_STATUSES.includes(event.fromStatus);

    if (!wasUnderWay) {
      return [];
    }

    const recipients = [
      event.actor !== TripActorEnum.CUSTOMER ? event.customerId : null,
      event.actor !== TripActorEnum.DRIVER ? event.driverId : null,
    ].filter((userId): userId is number => userId !== null);

    return recipients.map((userId) =>
      TripEventsHandler.intent(
        event,
        NotificationTypeEnum.TRIP_CANCELLED,
        userId,
        {
          ...TripEventsHandler.route(event),
          cancelledBy: CANCELLED_BY[event.actor],
          reason: event.reason,
        },
      ),
    );
  }

  private async contacts(
    event: TripStatusChangedEvent,
  ): Promise<[UserContact | null, UserContact | null]> {
    return Promise.all([
      this.authServiceClient.getUserContact(event.customerId),
      event.driverId === null
        ? null
        : this.authServiceClient.getUserContact(event.driverId),
    ]);
  }

  private static route(event: TripStatusChangedEvent) {
    return {
      tripId: event.tripId,
      pickupAddress: event.pickupAddress,
      dropoffAddress: event.dropoffAddress,
    };
  }

  private static fullName(contact: UserContact): string {
    return `${contact.firstName} ${contact.lastName}`;
  }

  private static intent<Type extends NotificationTypeEnum>(
    event: TripStatusChangedEvent,
    type: Type,
    userId: number,
    data: NotificationDataMap[Type],
  ): NotificationIntent<Type> {
    return {
      type,
      userId,
      data,
      dedupeKey: `${event.eventId}:${type}:${userId}`,
    };
  }
}

export default TripEventsHandler;

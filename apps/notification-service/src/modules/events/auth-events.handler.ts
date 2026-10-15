import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { dayjs } from '@masr3/libs/date';
import {
  BaseAuthEvent,
  PasswordResetCompletedEvent,
  PasswordResetRequestedEvent,
  UserChangedPasswordEvent,
  UserLoggedInEvent,
  UserRegisteredEvent,
} from '@masr3/libs/kafka';

import { NotificationTypeEnum } from '../notification/notification.enum';
import {
  NotificationDataMap,
  NotificationIntent,
  NotificationSecrets,
} from '../notification/notification.interface';

// auth.* events → notification intents. Decides what and for whom; never how
// it reads or which channel it goes to.
@Injectable()
class AuthEventsHandler {
  private readonly resetUrlBase: string;

  constructor(configService: ConfigService) {
    this.resetUrlBase = configService.getOrThrow<string>(
      'PASSWORD_RESET_URL_BASE',
    );
  }

  handleUserRegistered(event: UserRegisteredEvent): NotificationIntent[] {
    return [
      AuthEventsHandler.intent(event, NotificationTypeEnum.WELCOME, {
        email: event.email,
      }),
    ];
  }

  handleUserLoggedIn(event: UserLoggedInEvent): NotificationIntent[] {
    return [
      AuthEventsHandler.intent(event, NotificationTypeEnum.NEW_LOGIN, {
        occurredAt: event.occurredAt,
        ip: event.ip ?? null,
        userAgent: event.userAgent ?? null,
      }),
    ];
  }

  // People sign out on purpose; nothing to tell them.
  handleUserLoggedOut(): NotificationIntent[] {
    return [];
  }

  handleUserChangedPassword(
    event: UserChangedPasswordEvent,
  ): NotificationIntent[] {
    return [
      AuthEventsHandler.intent(event, NotificationTypeEnum.PASSWORD_CHANGED, {
        occurredAt: event.occurredAt,
      }),
    ];
  }

  // The reset link carries the raw token, so it is a secret: it reaches the
  // email but never the notifications table.
  handlePasswordResetRequested(
    event: PasswordResetRequestedEvent,
  ): NotificationIntent[] {
    const expiresInMinutes = Math.max(
      1,
      Math.round(
        dayjs(event.expiresAt).diff(dayjs(event.occurredAt), 'minute', true),
      ),
    );
    const secrets: NotificationSecrets = {
      resetUrl: `${this.resetUrlBase}?token=${encodeURIComponent(event.resetToken)}`,
    };

    return [
      {
        ...AuthEventsHandler.intent(
          event,
          NotificationTypeEnum.PASSWORD_RESET,
          {
            expiresInMinutes,
          },
        ),
        secrets,
      },
    ];
  }

  handlePasswordResetCompleted(
    event: PasswordResetCompletedEvent,
  ): NotificationIntent[] {
    return [
      AuthEventsHandler.intent(
        event,
        NotificationTypeEnum.PASSWORD_RESET_COMPLETED,
        {
          occurredAt: event.occurredAt,
        },
      ),
    ];
  }

  private static intent<Type extends NotificationTypeEnum>(
    event: BaseAuthEvent,
    type: Type,
    data: NotificationDataMap[Type],
  ): NotificationIntent<Type> {
    return {
      type,
      userId: event.userId,
      data,
      dedupeKey: `${event.eventId}:${type}:${event.userId}`,
    };
  }
}

export default AuthEventsHandler;

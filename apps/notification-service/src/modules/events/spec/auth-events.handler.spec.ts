import { ConfigService } from '@nestjs/config';

import { NotificationTypeEnum } from '../../notification/notification.enum';
import AuthEventsHandler from '../auth-events.handler';

describe('AuthEventsHandler', () => {
  const handler = new AuthEventsHandler({
    getOrThrow: () => 'http://localhost:3000/reset-password',
  } as unknown as ConfigService);

  const event = {
    eventId: 'event-1',
    occurredAt: '2026-10-12T08:00:00.000Z',
    userId: 7,
    email: 'demo@masr3.local',
    firstName: 'Demo',
  };

  it('turns a registration into a WELCOME for the user, keyed by event, type and user', () => {
    expect(handler.handleUserRegistered(event)).toEqual([
      {
        type: NotificationTypeEnum.WELCOME,
        userId: 7,
        data: { email: 'demo@masr3.local' },
        dedupeKey: 'event-1:WELCOME:7',
      },
    ]);
  });

  it('passes the raw sign-in time and device, null when missing', () => {
    const [intent] = handler.handleUserLoggedIn({
      ...event,
      ip: '203.0.113.42',
    });

    expect(intent.type).toBe(NotificationTypeEnum.NEW_LOGIN);
    expect(intent.data).toEqual({
      occurredAt: event.occurredAt,
      ip: '203.0.113.42',
      userAgent: null,
    });
  });

  it('sends nothing on logout', () => {
    expect(handler.handleUserLoggedOut()).toEqual([]);
  });

  it('carries the reset link as a secret, not as data', () => {
    const [intent] = handler.handlePasswordResetRequested({
      ...event,
      resetToken: 'tok en/1',
      expiresAt: '2026-10-12T08:10:00.000Z',
    });

    expect(intent.type).toBe(NotificationTypeEnum.PASSWORD_RESET);
    expect(intent.data).toEqual({ expiresInMinutes: 10 });
    expect(JSON.stringify(intent.data)).not.toContain('tok');
    expect(intent.secrets).toEqual({
      resetUrl: 'http://localhost:3000/reset-password?token=tok%20en%2F1',
    });
  });

  it.each([
    ['handleUserChangedPassword', NotificationTypeEnum.PASSWORD_CHANGED],
    [
      'handlePasswordResetCompleted',
      NotificationTypeEnum.PASSWORD_RESET_COMPLETED,
    ],
  ] as const)('%s becomes %s with the time it happened', (method, type) => {
    expect(handler[method](event)).toEqual([
      expect.objectContaining({ type, data: { occurredAt: event.occurredAt } }),
    ]);
  });
});

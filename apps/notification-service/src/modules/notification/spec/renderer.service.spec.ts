import { ConfigService } from '@nestjs/config';

import {
  CHANNEL_TEMPLATE_PARTS,
  DEFAULT_LOCALE,
  NOTIFICATION_CATALOG,
} from '../notification.constant';
import {
  NotificationChannelEnum,
  NotificationTypeEnum,
  TemplatePartEnum,
  TripCancelledByEnum,
} from '../notification.enum';
import {
  RenderedEmail,
  RenderedShortMessage,
  RenderedText,
} from '../notification.interface';
import { NOTIFICATION_HELPERS } from '../rendering/handlebars-helpers';
import RendererService from '../rendering/renderer.service';
import TemplateRegistryService from '../rendering/template-registry.service';

// Runs against the real template files, so a broken template fails here.
describe('rendering', () => {
  const registry = new TemplateRegistryService();
  const renderer = new RendererService(registry, {
    getOrThrow: () => 'Masr3',
  } as unknown as ConfigService);

  const trip = {
    tripId: 42,
    pickupAddress: 'Tahrir & <Square>',
    dropoffAddress: 'Zamalek',
    fare: 95,
    currency: 'EGP',
    driverName: 'Omar Driver',
    customerFirstName: 'Ahmed',
    completedAt: '2026-10-12T08:04:00.000Z',
    cancelledBy: TripCancelledByEnum.DRIVER,
    reason: null,
  };

  const render = (
    type: NotificationTypeEnum,
    channel: NotificationChannelEnum,
    data: object = trip,
    locale = DEFAULT_LOCALE,
  ) =>
    renderer.render({
      type,
      channel,
      locale,
      firstName: 'Ahmed',
      address: 'ahmed@masr3.local',
      data,
    });

  describe('TemplateRegistryService', () => {
    it('has an English template for every part of every default channel', () => {
      for (const [type, entry] of Object.entries(NOTIFICATION_CATALOG)) {
        for (const channel of entry.defaultChannels) {
          for (const part of CHANNEL_TEMPLATE_PARTS[channel]) {
            expect(() =>
              registry.part(type as NotificationTypeEnum, part, DEFAULT_LOCALE),
            ).not.toThrow();
          }
        }
      }
    });

    it('falls back to English for a locale with no templates yet', () => {
      expect(
        registry.resolveLocale(NotificationTypeEnum.TRIP_RECEIPT, 'ar'),
      ).toBe('en');
      expect(
        registry.part(
          NotificationTypeEnum.TRIP_RECEIPT,
          TemplatePartEnum.TITLE,
          'ar',
        ),
      ).toBe(
        registry.part(
          NotificationTypeEnum.TRIP_RECEIPT,
          TemplatePartEnum.TITLE,
          'en',
        ),
      );
    });

    it('builds deep links from the data', () => {
      expect(
        registry.deepLink(NotificationTypeEnum.TRIP_RECEIPT)?.({ tripId: 42 }),
      ).toBe('masr3://trips/42');
      expect(registry.deepLink(NotificationTypeEnum.WELCOME)).toBeNull();
    });
  });

  describe('RendererService', () => {
    it('renders an email into the layout, escaping values in HTML only', () => {
      const email = render(
        NotificationTypeEnum.TRIP_RECEIPT,
        NotificationChannelEnum.EMAIL,
      ) as RenderedEmail;

      expect(email.subject).toBe('Your trip receipt');
      expect(email.html).toContain('Tahrir &amp; &lt;Square&gt;');
      expect(email.html).not.toContain('<Square>');
      expect(email.html).toContain('Hi Ahmed,');
      expect(email.html).toContain('dir="ltr"');
      expect(email.text).toContain('From: Tahrir & <Square>');
      expect(email.text).toContain('Fare paid: EGP 95.00');
      expect(email.text).toContain(
        'Completed: Monday, 12 October 2026 at 08:04 UTC',
      );
      expect(email.text).toContain(
        "You're getting this because of your trip #42 on Masr3.",
      );
    });

    it('marks security emails and names the address in their footer', () => {
      const email = render(
        NotificationTypeEnum.PASSWORD_CHANGED,
        NotificationChannelEnum.EMAIL,
        { occurredAt: '2026-10-12T08:04:00.000Z' },
      ) as RenderedEmail;

      expect(email.html).toContain('Security notice');
      expect(email.html).toContain('#E09A1A');
      expect(email.text).toContain(
        'This is a security notice for ahmed@masr3.local.',
      );
    });

    it('leaves out rows whose value is missing', () => {
      const email = render(
        NotificationTypeEnum.TRIP_RECEIPT,
        NotificationChannelEnum.EMAIL,
        {
          ...trip,
          driverName: null,
        },
      ) as RenderedEmail;

      expect(email.text).not.toContain('Driver:');
    });

    it('renders push and in-app as a title, body and deep link', () => {
      const message = render(
        NotificationTypeEnum.TRIP_CANCELLED,
        NotificationChannelEnum.IN_APP,
        { ...trip, reason: 'Car broke down' },
      ) as RenderedShortMessage;

      expect(message).toEqual({
        title: 'Trip #42 cancelled',
        body: 'Cancelled by your driver: Car broke down.',
        deepLink: 'masr3://trips/42',
      });
    });

    it('renders SMS as plain text', () => {
      const message = render(
        NotificationTypeEnum.TRIP_ASSIGNED,
        NotificationChannelEnum.SMS,
      ) as RenderedText;

      expect(message.text).toBe(
        'Masr3: new trip #42. Pick up at Tahrir & <Square>, fare EGP 95.00.',
      );
    });

    it('puts a secret into the email without it being part of the data', () => {
      const email = renderer.render({
        type: NotificationTypeEnum.PASSWORD_RESET,
        channel: NotificationChannelEnum.EMAIL,
        locale: 'en',
        firstName: 'Ahmed',
        address: 'ahmed@masr3.local',
        data: { expiresInMinutes: 10 },
        secrets: { resetUrl: 'http://localhost:3000/reset-password?token=abc' },
      }) as RenderedEmail;

      expect(email.text).toContain(
        'http://localhost:3000/reset-password?token=abc',
      );
      expect(email.html).toContain(
        'href="http://localhost:3000/reset-password?token&#x3D;abc"',
      );
    });

    it('passes attachments through to the email', () => {
      const attachments = [
        {
          filename: 'trips.pdf',
          contentType: 'application/pdf',
          url: 'http://files/trips.pdf',
        },
      ];
      const email = renderer.render({
        type: NotificationTypeEnum.TRIP_RECEIPT,
        channel: NotificationChannelEnum.EMAIL,
        locale: 'en',
        firstName: 'Ahmed',
        address: 'ahmed@masr3.local',
        data: trip,
        attachments,
      }) as RenderedEmail;

      expect(email.attachments).toEqual(attachments);
    });
  });

  describe('helpers', () => {
    it('formats money with two decimals and the currency', () => {
      expect(NOTIFICATION_HELPERS.money(85.5, 'EGP')).toBe('EGP 85.50');
    });

    it('formats dates readably, in UTC', () => {
      expect(NOTIFICATION_HELPERS.date('2026-10-12T08:04:00.000Z')).toBe(
        'Monday, 12 October 2026 at 08:04 UTC',
      );
    });

    it('compares values', () => {
      expect(NOTIFICATION_HELPERS.eq('DRIVER', 'DRIVER')).toBe(true);
      expect(NOTIFICATION_HELPERS.eq('DRIVER', 'CUSTOMER')).toBe(false);
    });
  });
});

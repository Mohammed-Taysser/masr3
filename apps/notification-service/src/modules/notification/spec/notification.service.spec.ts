import { ConfigService } from '@nestjs/config';
import { QueryFailedError, Repository } from 'typeorm';

import MailService from '../../mail/mail.service';
import NotificationEntity from '../entities/notification.entity';
import { MASKED_TOKEN } from '../notification.constant';
import {
  NotificationStatusEnum,
  NotificationTemplateEnum,
} from '../notification.enum';
import NotificationService from '../notification.service';
import TemplateService from '../templates/template.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let mailService: jest.Mocked<MailService>;
  let repository: jest.Mocked<Repository<NotificationEntity>>;

  const config: Record<string, string> = {
    APP_NAME: 'Masr3',
    PASSWORD_RESET_URL_BASE: 'http://localhost:3000/reset-password',
  };

  const base = {
    eventId: 'event-1',
    occurredAt: '2026-10-01T12:00:00.000Z',
    userId: 1,
    email: 'demo@example.com',
    firstName: 'Demo',
  };

  const uniqueViolation = () =>
    new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('duplicate'), {
        code: '23505',
      }),
    );

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) => config[key]),
      getOrThrow: jest.fn((key: string) => config[key]),
    } as unknown as ConfigService;

    mailService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailService>;

    repository = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
    } as unknown as jest.Mocked<Repository<NotificationEntity>>;

    service = new NotificationService(
      configService,
      mailService,
      new TemplateService(),
      repository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('claims a PENDING row before sending, then marks it SENT', async () => {
      // The service mutates the saved row, so record each save's state as it
      // happens rather than inspecting the (shared) object afterwards.
      const saved: Partial<NotificationEntity>[] = [];

      repository.save.mockImplementation(async (row) => {
        saved.push({ ...(row as NotificationEntity) });

        return row as NotificationEntity;
      });

      const result = await service.handleUserRegistered(base);

      expect(saved[0]).toEqual(
        expect.objectContaining({
          eventId: 'event-1',
          status: NotificationStatusEnum.PENDING,
          template: NotificationTemplateEnum.WELCOME,
        }),
      );

      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'demo@example.com' }),
      );

      expect(result?.status).toBe(NotificationStatusEnum.SENT);
    });

    it('records a delivery failure as FAILED instead of throwing', async () => {
      mailService.sendMail.mockRejectedValue(new Error('SMTP down'));

      const result = await service.handleUserRegistered(base);

      expect(result?.status).toBe(NotificationStatusEnum.FAILED);
      expect(result?.error).toBe('SMTP down');
    });

    it('skips a redelivered event without sending a second email', async () => {
      repository.save.mockRejectedValueOnce(uniqueViolation());

      const result = await service.handleUserRegistered(base);

      expect(result).toBeNull();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('rethrows database errors other than a duplicate', async () => {
      repository.save.mockRejectedValueOnce(new Error('connection refused'));

      await expect(service.handleUserRegistered(base)).rejects.toThrow(
        'connection refused',
      );

      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('handlePasswordResetRequested', () => {
    const event = {
      ...base,
      resetToken: 'raw-reset-token',
      expiresAt: '2026-10-01T12:10:00.000Z',
    };

    it('sends the live link but stores only the masked one', async () => {
      await service.handlePasswordResetRequested(event);

      const sent = mailService.sendMail.mock.calls[0][0];

      expect(sent.html).toContain('?token=raw-reset-token');
      expect(sent.text).toContain('?token=raw-reset-token');

      const stored = (repository.save.mock.calls[0][0] as NotificationEntity)
        .body;

      expect(stored).not.toContain('raw-reset-token');
      expect(stored).toContain(`?token=${encodeURIComponent(MASKED_TOKEN)}`);
    });

    it('states the expiry in minutes from the event', async () => {
      await service.handlePasswordResetRequested(event);

      expect(mailService.sendMail.mock.calls[0][0].text).toContain(
        'expires in 10 minutes',
      );
    });
  });

  describe('handleUserLoggedIn', () => {
    it('renders the details as table rows, escaping user-controlled values', async () => {
      await service.handleUserLoggedIn({
        ...base,
        ip: '203.0.113.42',
        userAgent: '<script>alert(1)</script>',
      });

      const { html, text } = mailService.sendMail.mock.calls[0][0];

      expect(html).toMatch(/<td[^>]*>203\.0\.113\.42<\/td>/);
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('&lt;tr');

      expect(text).toContain('IP address: 203.0.113.42');
    });
  });

  describe('handleUserLoggedOut', () => {
    it('sends nothing and stores nothing', async () => {
      await service.handleUserLoggedOut(base);

      expect(mailService.sendMail).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});

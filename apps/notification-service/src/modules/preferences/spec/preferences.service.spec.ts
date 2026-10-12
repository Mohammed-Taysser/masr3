import { Repository } from 'typeorm';

import { NotificationChannelEnum } from '../../notification/notification.enum';
import NotificationPreferenceEntity from '../entities/notification-preference.entity';
import PreferencesService from '../preferences.service';

describe('PreferencesService', () => {
  let service: PreferencesService;
  let repository: jest.Mocked<Repository<NotificationPreferenceEntity>>;
  let upserted: Record<string, unknown> | null;
  let overwritten: string[];

  const row = (changes: Partial<NotificationPreferenceEntity> = {}) =>
    ({
      userId: 1,
      email: true,
      sms: true,
      whatsapp: true,
      push: true,
      inApp: true,
      ...changes,
    }) as NotificationPreferenceEntity;

  beforeEach(() => {
    upserted = null;
    overwritten = [];

    const builder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn((values: Record<string, unknown>) => {
        upserted = values;

        return builder;
      }),
      orUpdate: jest.fn((columns: string[]) => {
        overwritten = columns;

        return builder;
      }),
      execute: jest.fn(),
    };

    repository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => builder),
    } as unknown as jest.Mocked<Repository<NotificationPreferenceEntity>>;
    service = new PreferencesService(repository);
  });

  it('has every channel on for a user who never changed anything', async () => {
    await expect(service.find(1)).resolves.toEqual({
      email: true,
      sms: true,
      whatsapp: true,
      push: true,
      inApp: true,
    });
    await expect(service.disabledChannels(1)).resolves.toEqual(new Set());
  });

  it('lists the channels a user turned off', async () => {
    repository.findOne.mockResolvedValue(row({ sms: false, push: false }));

    await expect(service.disabledChannels(1)).resolves.toEqual(
      new Set([NotificationChannelEnum.SMS, NotificationChannelEnum.PUSH]),
    );
  });

  it('upserts the one row per user, keeping switches that were left out', async () => {
    repository.findOne.mockResolvedValue(row({ push: false }));

    await expect(service.update(1, { sms: false })).resolves.toEqual({
      email: true,
      sms: false,
      whatsapp: true,
      push: false,
      inApp: true,
    });
    expect(upserted).toEqual({
      userId: 1,
      email: true,
      sms: false,
      whatsapp: true,
      push: false,
      inApp: true,
    });
    expect(overwritten).toEqual(['email', 'sms', 'whatsapp', 'push', 'inApp']);
  });
});

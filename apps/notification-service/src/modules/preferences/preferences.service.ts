import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NotificationChannelEnum } from '../notification/notification.enum';
import NotificationPreferenceEntity from './entities/notification-preference.entity';
import {
  CHANNEL_SWITCHES,
  DEFAULT_CHANNEL_PREFERENCES,
} from './preferences.constant';
import { ChannelPreferences } from './preferences.interface';

@Injectable()
class PreferencesService {
  constructor(
    @InjectRepository(NotificationPreferenceEntity)
    private readonly preferenceRepository: Repository<NotificationPreferenceEntity>,
  ) {}

  async find(userId: number): Promise<ChannelPreferences> {
    const row = await this.preferenceRepository.findOne({ where: { userId } });

    if (!row) {
      return DEFAULT_CHANNEL_PREFERENCES;
    }

    return {
      email: row.email,
      sms: row.sms,
      whatsapp: row.whatsapp,
      push: row.push,
      inApp: row.inApp,
    };
  }

  async disabledChannels(
    userId: number,
  ): Promise<Set<NotificationChannelEnum>> {
    const preferences = await this.find(userId);
    const channels = Object.entries(CHANNEL_SWITCHES)
      .filter(([, column]) => !preferences[column])
      .map(([channel]) => channel as NotificationChannelEnum);

    return new Set(channels);
  }

  async update(
    userId: number,
    changes: Partial<ChannelPreferences>,
  ): Promise<ChannelPreferences> {
    const preferences = { ...(await this.find(userId)), ...changes };

    await this.preferenceRepository
      .createQueryBuilder()
      .insert()
      .into(NotificationPreferenceEntity)
      .values({ userId, ...preferences })
      .orUpdate(Object.keys(preferences), ['userId'])
      .execute();

    return preferences;
  }
}

export default PreferencesService;

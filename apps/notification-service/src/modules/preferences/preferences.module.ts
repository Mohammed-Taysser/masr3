import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import NotificationPreferenceEntity from './entities/notification-preference.entity';
import PreferencesController from './preferences.controller';
import PreferencesService from './preferences.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationPreferenceEntity])],
  controllers: [PreferencesController],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
class PreferencesModule {}

export default PreferencesModule;

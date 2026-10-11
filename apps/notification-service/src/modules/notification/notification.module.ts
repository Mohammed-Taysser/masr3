import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import MailModule from '../mail/mail.module';
import NotificationEntity from './entities/notification.entity';
import NotificationService from './notification.service';
import TemplateService from './templates/template.service';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    TypeOrmModule.forFeature([NotificationEntity]),
  ],
  providers: [NotificationService, TemplateService],
  exports: [NotificationService],
})
class NotificationModule {}

export default NotificationModule;

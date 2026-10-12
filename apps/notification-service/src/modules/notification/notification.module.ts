import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import AuthServiceClientModule from '../../clients/auth-service-client.module';
import MailModule from '../mail/mail.module';
import PreferencesModule from '../preferences/preferences.module';
import DeliveriesController from './deliveries.controller';
import ChannelProviderRegistry from './delivery/channel-provider.registry';
import DeliveryLogService from './delivery/delivery-log.service';
import DeliveryQueueService from './delivery/delivery-queue.service';
import DeliverySweepProcessor from './delivery/delivery-sweep.processor';
import DeliveryService from './delivery/delivery.service';
import EmailDeliveryProcessor from './delivery/email-delivery.processor';
import InAppDeliveryProcessor from './delivery/in-app-delivery.processor';
import EmailProvider from './delivery/providers/email.provider';
import InAppProvider from './delivery/providers/in-app.provider';
import LogProvider from './delivery/providers/log.provider';
import NotificationDeliveryEntity from './entities/notification-delivery.entity';
import NotificationEntity from './entities/notification.entity';
import {
  NOTIFICATION_EMAIL_QUEUE,
  NOTIFICATION_IN_APP_QUEUE,
  NOTIFICATION_SWEEP_QUEUE,
} from './notification.constant';
import NotifierService from './notifier.service';
import RecipientService from './recipient.service';
import RendererService from './rendering/renderer.service';
import TemplateRegistryService from './rendering/template-registry.service';

@Module({
  imports: [
    MailModule,
    AuthServiceClientModule,
    PreferencesModule,
    TypeOrmModule.forFeature([NotificationEntity, NotificationDeliveryEntity]),
    BullModule.registerQueue(
      { name: NOTIFICATION_EMAIL_QUEUE },
      { name: NOTIFICATION_IN_APP_QUEUE },
      { name: NOTIFICATION_SWEEP_QUEUE },
    ),
  ],
  controllers: [DeliveriesController],
  providers: [
    NotifierService,
    RecipientService,
    TemplateRegistryService,
    RendererService,
    EmailProvider,
    InAppProvider,
    LogProvider,
    ChannelProviderRegistry,
    DeliveryQueueService,
    DeliveryService,
    DeliveryLogService,
    EmailDeliveryProcessor,
    InAppDeliveryProcessor,
    DeliverySweepProcessor,
  ],
  exports: [NotifierService, RendererService],
})
class NotificationModule {}

export default NotificationModule;

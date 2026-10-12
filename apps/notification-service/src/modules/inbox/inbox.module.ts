import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import NotificationEntity from '../notification/entities/notification.entity';
import InboxController from './inbox.controller';
import InboxService from './inbox.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity])],
  controllers: [InboxController],
  providers: [InboxService],
})
class InboxModule {}

export default InboxModule;

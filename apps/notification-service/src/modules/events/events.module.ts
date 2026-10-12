import { Module } from '@nestjs/common';

import AuthServiceClientModule from '../../clients/auth-service-client.module';
import AuthEventsHandler from './auth-events.handler';
import TripEventsHandler from './trip-events.handler';

@Module({
  imports: [AuthServiceClientModule],
  providers: [AuthEventsHandler, TripEventsHandler],
  exports: [AuthEventsHandler, TripEventsHandler],
})
class EventsModule {}

export default EventsModule;

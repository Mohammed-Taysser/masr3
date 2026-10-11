import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { TripEventMap } from '@masr3/libs';

import OutboxEventEntity from './entities/outbox-event.entity';

@Injectable()
class OutboxService {
  // Takes the caller's manager so the event commits or rolls back with the
  // state change that produced it.
  async enqueue<Topic extends keyof TripEventMap>(
    manager: EntityManager,
    topic: Topic,
    event: TripEventMap[Topic],
    key: string,
  ): Promise<void> {
    await manager.insert(OutboxEventEntity, {
      eventId: event.eventId,
      topic,
      key,
      payload: event,
    });
  }
}

export default OutboxService;

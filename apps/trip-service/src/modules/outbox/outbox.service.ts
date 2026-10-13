import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { createKafkaEvent, EventPayload } from '@masr3/libs';

import OutboxEventEntity from './entities/outbox-event.entity';
import { OutboxEventMap } from './outbox.interface';

@Injectable()
class OutboxService {
  // Takes the caller's manager so the event commits or rolls back with the
  // state change that produced it.
  async enqueue<Topic extends keyof OutboxEventMap>(
    manager: EntityManager,
    topic: Topic,
    payload: EventPayload<OutboxEventMap[Topic]>,
    key: string,
  ): Promise<void> {
    // occurredAt is the moment of the change: this runs inside its transaction.
    const event = createKafkaEvent<OutboxEventMap[Topic]>(payload);

    await manager.insert(OutboxEventEntity, {
      eventId: event.eventId,
      topic,
      key,
      payload: event,
    });
  }
}

export default OutboxService;

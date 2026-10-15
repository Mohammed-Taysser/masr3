import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { createKafkaEvent, EventPayload } from '../kafka/kafka.events';
import OutboxEventEntity from './entities/outbox-event.entity';
import { OutboxEventMapOf } from './outbox.interface';

// Inject it typed with the service's own map, e.g.
// `private readonly outboxService: OutboxService<OutboxEventMap>`, so a topic
// the service does not publish, or a wrong payload, does not compile.
@Injectable()
class OutboxService<EventMap extends OutboxEventMapOf<EventMap>> {
  // Takes the caller's manager so the event commits or rolls back with the
  // state change that produced it.
  async enqueue<Topic extends keyof EventMap & string>(
    manager: EntityManager,
    topic: Topic,
    payload: EventPayload<EventMap[Topic]>,
    key: string,
  ): Promise<void> {
    // occurredAt is the moment of the change: this runs inside its transaction.
    const event = createKafkaEvent<EventMap[Topic]>(payload);

    await manager.insert(OutboxEventEntity, {
      eventId: event.eventId,
      topic,
      key,
      payload: event,
    });
  }
}

export default OutboxService;

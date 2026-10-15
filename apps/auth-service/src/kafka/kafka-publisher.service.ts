import { Injectable, Logger } from '@nestjs/common';

import {
  AuthEventMap,
  createKafkaEvent,
  EventPayload,
  KafkaProducerService,
} from '@masr3/libs/kafka';

import { DirectAuthKafkaTopic } from './kafka.interface';

// Best-effort publishing for the one event that cannot go through the outbox
// (DirectAuthKafkaTopic). A failed send is logged, never thrown into the
// request: the user can ask for another reset email.
@Injectable()
class KafkaPublisherService {
  private readonly logger = new Logger(KafkaPublisherService.name);

  constructor(private readonly producer: KafkaProducerService) {}

  async publish<Topic extends DirectAuthKafkaTopic>(
    topic: Topic,
    payload: EventPayload<AuthEventMap[Topic]>,
  ) {
    const event = createKafkaEvent<AuthEventMap[Topic]>(payload);

    try {
      await this.producer.sendBatch([
        {
          topic,
          // Keyed by user so every event for one user lands on the same
          // partition and is consumed in the order it was produced.
          messages: [
            { key: String(event.userId), value: JSON.stringify(event) },
          ],
        },
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic} (${event.eventId}): ${(error as Error).message}`,
      );
    }
  }
}

export default KafkaPublisherService;

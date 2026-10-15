import { ModuleMetadata, Type } from '@nestjs/common';
import { TopicMessages } from 'kafkajs';

import { BaseKafkaEvent } from '../kafka/kafka.events';

// What the relay needs from a service's Kafka producer.
interface OutboxProducer {
  sendBatch(topicMessages: TopicMessages[]): Promise<void>;
}

interface OutboxModuleOptions {
  // The module that provides `producer`.
  imports: ModuleMetadata['imports'];
  producer: Type<OutboxProducer>;
}

// Topic → event of everything a service publishes through its outbox.
type OutboxEventMapOf<EventMap> = {
  [Topic in keyof EventMap]: BaseKafkaEvent;
};

export type { OutboxEventMapOf, OutboxModuleOptions, OutboxProducer };

import { Module } from '@nestjs/common';

import KafkaProducerService from './kafka-producer.service';

// Reads KAFKA_BROKER and KAFKA_CLIENT_ID from the service's global
// ConfigModule. OutboxModule imports it; Nest keeps one producer per app.
@Module({
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
class KafkaProducerModule {}

export default KafkaProducerModule;

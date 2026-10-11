import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Message, TopicMessages } from 'kafkajs';
import { DataSource, EntityManager, In, IsNull, LessThan } from 'typeorm';

import { dayjs } from '@masr3/libs';

import KafkaProducerService from '../../kafka/kafka-producer.service';
import OutboxEventEntity from './entities/outbox-event.entity';
import { OUTBOX_RELAY_LOCK_ID } from './outbox.constant';

@Injectable()
class OutboxRelayService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly retentionMs: number;
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;
  private stopped = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly producer: KafkaProducerService,
    configService: ConfigService,
  ) {
    this.pollIntervalMs = configService.getOrThrow<number>(
      'OUTBOX_POLL_INTERVAL_MS',
    );
    this.batchSize = configService.getOrThrow<number>('OUTBOX_BATCH_SIZE');
    this.retentionMs = configService.getOrThrow<number>('OUTBOX_RETENTION_MS');
  }

  onApplicationBootstrap() {
    this.schedule();
  }

  async onModuleDestroy() {
    this.stopped = true;

    if (this.timer) {
      clearTimeout(this.timer);
    }

    await this.inFlight;
  }

  // The next tick is scheduled only after this one finishes, so ticks never
  // overlap.
  private schedule() {
    if (this.stopped) {
      return;
    }

    this.timer = setTimeout(async () => {
      this.inFlight = this.relay().catch((error: Error) =>
        this.logger.error(`Outbox relay tick failed: ${error.message}`),
      );
      await this.inFlight;
      this.inFlight = null;
      this.schedule();
    }, this.pollIntervalMs);
  }

  async relay(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const [{ locked }] = await manager.query(
        'SELECT pg_try_advisory_xact_lock($1) AS locked',
        [OUTBOX_RELAY_LOCK_ID],
      );

      if (!locked) {
        return;
      }

      const events = await manager.find(OutboxEventEntity, {
        where: { publishedAt: IsNull() },
        order: { id: 'ASC' },
        take: this.batchSize,
      });

      if (events.length > 0) {
        await this.publish(manager, events);
      }

      await manager.delete(OutboxEventEntity, {
        publishedAt: LessThan(
          dayjs().subtract(this.retentionMs, 'millisecond').toDate(),
        ),
      });
    });
  }

  private async publish(
    manager: EntityManager,
    events: OutboxEventEntity[],
  ): Promise<void> {
    const ids = { id: In(events.map((event) => event.id)) };

    try {
      await this.producer.sendBatch(OutboxRelayService.toTopicMessages(events));
    } catch (error) {
      const message = (error as Error).message;

      this.logger.error(
        `Publishing ${events.length} outbox event(s) failed; retrying next tick: ${message}`,
      );
      await manager.increment(OutboxEventEntity, ids, 'attempts', 1);
      await manager.update(OutboxEventEntity, ids, { lastError: message });

      return;
    }

    await manager.update(OutboxEventEntity, ids, {
      publishedAt: dayjs().toDate(),
      lastError: null,
    });
  }

  // Keeps id order within each topic, so a key's messages leave in the order
  // they were written.
  private static toTopicMessages(events: OutboxEventEntity[]): TopicMessages[] {
    const byTopic = new Map<string, Message[]>();

    for (const event of events) {
      const messages = byTopic.get(event.topic) ?? [];

      messages.push({ key: event.key, value: JSON.stringify(event.payload) });
      byTopic.set(event.topic, messages);
    }

    return [...byTopic].map(([topic, messages]) => ({ topic, messages }));
  }
}

export default OutboxRelayService;

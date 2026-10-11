import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';

import { dayjs } from '@masr3/libs';

import KafkaProducerService from '../../../kafka/kafka-producer.service';
import OutboxEventEntity from '../entities/outbox-event.entity';
import OutboxRelayService from '../outbox-relay.service';
import {
  OUTBOX_RELAY_LOCK_ID,
  OUTBOX_RELAY_SCHEDULER_ID,
} from '../outbox.constant';
import { OutboxJobEnum } from '../outbox.enum';

const RETENTION_MS = 604800000;

const config: Record<string, number> = {
  OUTBOX_POLL_INTERVAL_MS: 1000,
  OUTBOX_BATCH_SIZE: 100,
  OUTBOX_RETENTION_MS: RETENTION_MS,
};

const outboxRow = (id: number, topic: string, key: string) =>
  ({ id, topic, key, payload: { id } }) as unknown as OutboxEventEntity;

describe('OutboxRelayService', () => {
  let relay: OutboxRelayService;
  let manager: jest.Mocked<EntityManager>;
  let producer: jest.Mocked<KafkaProducerService>;
  let relayQueue: jest.Mocked<Queue>;

  const lockResult = (locked: boolean) =>
    manager.query.mockResolvedValue([{ locked }]);

  beforeEach(() => {
    manager = {
      query: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      increment: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    const dataSource = {
      transaction: jest.fn((work: (m: EntityManager) => unknown) =>
        work(manager),
      ),
    } as unknown as DataSource;

    producer = {
      sendBatch: jest.fn(),
    } as unknown as jest.Mocked<KafkaProducerService>;

    const configService = {
      getOrThrow: jest.fn((key: string) => config[key]),
    } as unknown as ConfigService;

    relayQueue = {
      upsertJobScheduler: jest.fn(),
    } as unknown as jest.Mocked<Queue>;

    relay = new OutboxRelayService(
      dataSource,
      producer,
      relayQueue,
      configService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('schedules a RELAY job every OUTBOX_POLL_INTERVAL_MS on boot', async () => {
    await relay.onApplicationBootstrap();

    expect(relayQueue.upsertJobScheduler).toHaveBeenCalledWith(
      OUTBOX_RELAY_SCHEDULER_ID,
      { every: config.OUTBOX_POLL_INTERVAL_MS },
      { name: OutboxJobEnum.RELAY },
    );
  });

  it('does nothing when another instance holds the relay lock', async () => {
    lockResult(false);

    await relay.relay();

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_xact_lock($1) AS locked',
      [OUTBOX_RELAY_LOCK_ID],
    );
    expect(manager.find).not.toHaveBeenCalled();
    expect(producer.sendBatch).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('publishes pending rows oldest first, keyed, then marks them published', async () => {
    lockResult(true);
    manager.find.mockResolvedValue([
      outboxRow(1, 'trip.status-changed', '7'),
      outboxRow(2, 'trip.status-changed', '8'),
      outboxRow(3, 'trip.status-changed', '7'),
    ]);

    await relay.relay();

    expect(manager.find).toHaveBeenCalledWith(OutboxEventEntity, {
      where: { publishedAt: IsNull() },
      order: { id: 'ASC' },
      take: 100,
    });
    expect(producer.sendBatch).toHaveBeenCalledWith([
      {
        topic: 'trip.status-changed',
        messages: [
          { key: '7', value: JSON.stringify({ id: 1 }) },
          { key: '8', value: JSON.stringify({ id: 2 }) },
          { key: '7', value: JSON.stringify({ id: 3 }) },
        ],
      },
    ]);
    expect(manager.update).toHaveBeenCalledWith(
      OutboxEventEntity,
      { id: In([1, 2, 3]) },
      { publishedAt: expect.any(Date), lastError: null },
    );
    expect(manager.increment).not.toHaveBeenCalled();
  });

  it('keeps rows pending and records the failure when Kafka rejects the batch', async () => {
    lockResult(true);
    manager.find.mockResolvedValue([outboxRow(1, 'trip.status-changed', '7')]);
    producer.sendBatch.mockRejectedValue(new Error('broker down'));

    await relay.relay();

    expect(manager.increment).toHaveBeenCalledWith(
      OutboxEventEntity,
      { id: In([1]) },
      'attempts',
      1,
    );
    expect(manager.update).toHaveBeenCalledWith(
      OutboxEventEntity,
      { id: In([1]) },
      { lastError: 'broker down' },
    );
    expect(manager.update).not.toHaveBeenCalledWith(
      OutboxEventEntity,
      expect.anything(),
      expect.objectContaining({ publishedAt: expect.anything() }),
    );
  });

  it('skips sending when nothing is pending but still purges', async () => {
    lockResult(true);

    await relay.relay();

    expect(producer.sendBatch).not.toHaveBeenCalled();
    expect(manager.delete).toHaveBeenCalledTimes(1);
  });

  it('purges published rows older than OUTBOX_RETENTION_MS', async () => {
    lockResult(true);
    const before = dayjs();

    await relay.relay();

    const [, criteria] = manager.delete.mock.calls[0] as [
      unknown,
      { publishedAt: { value: Date } },
    ];
    const age = before.diff(dayjs(criteria.publishedAt.value), 'millisecond');

    expect(age).toBeGreaterThanOrEqual(RETENTION_MS - 5000);
    expect(age).toBeLessThanOrEqual(RETENTION_MS + 5000);
  });
});

import { ConfigService } from '@nestjs/config';
import { Kafka, TopicMessages } from 'kafkajs';

import KafkaProducerService from '../kafka-producer.service';
import { KAFKA_PRODUCER_RETRIES } from '../kafka.constant';

jest.mock('kafkajs');

describe('KafkaProducerService', () => {
  let service: KafkaProducerService;
  let onDisconnect: () => void;
  let createProducer: jest.Mock;

  const producer = {
    connect: jest.fn(),
    sendBatch: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    events: { DISCONNECT: 'producer.disconnect' },
  };

  const batch: TopicMessages[] = [
    { topic: 'example.created', messages: [{ key: '1', value: '{}' }] },
  ];

  beforeEach(() => {
    jest.resetAllMocks();
    producer.connect.mockResolvedValue(undefined);
    producer.sendBatch.mockResolvedValue(undefined);
    producer.on.mockImplementation((_event: string, listener: () => void) => {
      onDisconnect = listener;
    });
    createProducer = jest.fn().mockReturnValue(producer);
    jest
      .mocked(Kafka)
      .mockImplementation(
        () => ({ producer: createProducer }) as unknown as Kafka,
      );

    service = new KafkaProducerService({
      getOrThrow: jest.fn().mockReturnValue('value'),
    } as unknown as ConfigService);
  });

  it('is idempotent, one request in flight, with a bounded retry per send', () => {
    expect(createProducer).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotent: true,
        maxInFlightRequests: 1,
        retry: { retries: KAFKA_PRODUCER_RETRIES },
      }),
    );
  });

  it('does not connect until the first send, so the service boots without Kafka', () => {
    expect(producer.connect).not.toHaveBeenCalled();
  });

  it('connects once for concurrent sends', async () => {
    await Promise.all([service.sendBatch(batch), service.sendBatch(batch)]);

    expect(producer.connect).toHaveBeenCalledTimes(1);
    expect(producer.sendBatch).toHaveBeenCalledTimes(2);
    expect(producer.sendBatch).toHaveBeenCalledWith({ topicMessages: batch });
  });

  it('tries to connect again on the next send after a failed connect', async () => {
    producer.connect.mockRejectedValueOnce(new Error('broker down'));

    await expect(service.sendBatch(batch)).rejects.toThrow('broker down');
    await service.sendBatch(batch);

    expect(producer.connect).toHaveBeenCalledTimes(2);
    expect(producer.sendBatch).toHaveBeenCalledTimes(1);
  });

  it('reconnects after the producer disconnects', async () => {
    await service.sendBatch(batch);
    onDisconnect();
    await service.sendBatch(batch);

    expect(producer.connect).toHaveBeenCalledTimes(2);
  });

  it('throws a failed send so the outbox keeps its rows pending', async () => {
    producer.sendBatch.mockRejectedValueOnce(new Error('timeout'));

    await expect(service.sendBatch(batch)).rejects.toThrow('timeout');
  });
});

import { ConfigService } from '@nestjs/config';
import { IsInt, Min } from 'class-validator';
import { EachMessagePayload, Kafka } from 'kafkajs';

import BaseKafkaConsumer from '../base-kafka-consumer';
import KafkaEventDto from '../kafka-event.dto';
import { BaseKafkaEvent } from '../kafka.events';
import {
  KafkaEventDtos,
  KafkaSubscription,
  KafkaTopicHandlers,
} from '../kafka.interface';

jest.mock('kafkajs');

interface ExampleEvent extends BaseKafkaEvent {
  orderId: number;
}

interface ExampleEventMap {
  'example.created': ExampleEvent;
  'example.deleted': ExampleEvent;
}

class ExampleEventDto extends KafkaEventDto implements ExampleEvent {
  @IsInt()
  @Min(1)
  orderId!: number;
}

class ExampleConsumer extends BaseKafkaConsumer<ExampleEventMap> {
  protected readonly handlers: KafkaTopicHandlers<ExampleEventMap>;

  protected readonly eventDtos: KafkaEventDtos<ExampleEventMap> = {
    'example.created': ExampleEventDto,
    'example.deleted': ExampleEventDto,
  };

  protected readonly subscriptions: KafkaSubscription<ExampleEventMap>[] = [
    { topics: ['example.created'], fromBeginning: true },
    { topics: ['example.deleted'], fromBeginning: false },
  ];

  constructor(configService: ConfigService, handle: jest.Mock) {
    super(configService);

    this.handlers = {
      'example.created': handle,
      'example.deleted': handle,
    };
  }
}

describe('BaseKafkaConsumer', () => {
  let handle: jest.Mock;
  let eachMessage: (payload: EachMessagePayload) => Promise<void>;

  const consumer = {
    connect: jest.fn(),
    subscribe: jest.fn(),
    run: jest.fn(),
    disconnect: jest.fn(),
  };

  const event = {
    eventId: 'event-1',
    occurredAt: '2026-10-15T08:00:00.000Z',
    orderId: 7,
  };

  const deliver = (topic: string, value: unknown) =>
    eachMessage({
      topic,
      partition: 0,
      message: {
        offset: '0',
        value:
          value === null
            ? null
            : Buffer.from(
                typeof value === 'string' ? value : JSON.stringify(value),
              ),
      },
    } as unknown as EachMessagePayload);

  beforeEach(async () => {
    jest.resetAllMocks();
    consumer.run.mockImplementation(
      (config: { eachMessage: typeof eachMessage }) => {
        eachMessage = config.eachMessage;
      },
    );
    jest
      .mocked(Kafka)
      .mockImplementation(
        () => ({ consumer: () => consumer }) as unknown as Kafka,
      );

    handle = jest.fn().mockResolvedValue(undefined);

    await new ExampleConsumer(
      {
        getOrThrow: jest.fn().mockReturnValue('value'),
      } as unknown as ConfigService,
      handle,
    ).onModuleInit();
  });

  it('subscribes to each subscription with its own starting offset', () => {
    expect(consumer.subscribe).toHaveBeenCalledWith({
      topics: ['example.created'],
      fromBeginning: true,
    });
    expect(consumer.subscribe).toHaveBeenCalledWith({
      topics: ['example.deleted'],
      fromBeginning: false,
    });
  });

  it('hands a valid event to its topic handler as the validated DTO', async () => {
    await deliver('example.created', event);

    expect(handle).toHaveBeenCalledWith(expect.any(ExampleEventDto));
    expect(handle).toHaveBeenCalledWith(expect.objectContaining(event));
  });

  it.each([
    ['an empty message', null],
    ['invalid JSON', '{not json'],
    ['a JSON array', [event]],
    ['a missing eventId', { ...event, eventId: undefined }],
    ['a field failing the DTO', { ...event, orderId: 0 }],
  ])('skips %s without calling the handler', async (_case, value) => {
    await expect(deliver('example.created', value)).resolves.toBeUndefined();

    expect(handle).not.toHaveBeenCalled();
  });

  it('skips a topic it has no handler for', async () => {
    await deliver('example.unknown', event);

    expect(handle).not.toHaveBeenCalled();
  });

  it('rethrows a handler failure so the offset is not committed', async () => {
    handle.mockRejectedValue(new Error('connection lost'));

    await expect(deliver('example.created', event)).rejects.toThrow(
      'connection lost',
    );
  });
});

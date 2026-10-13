import { ConfigService } from '@nestjs/config';
import { EachMessagePayload } from 'kafkajs';

import {
  AuditActionEnum,
  AuditActorTypeEnum,
  AuditEntityTypeEnum,
  AuditKafkaTopic,
} from '@masr3/libs';

import AuditService from '../../modules/audit/audit.service';
import KafkaConsumerService from '../kafka-consumer.service';

describe('KafkaConsumerService', () => {
  let service: KafkaConsumerService;
  let auditService: jest.Mocked<AuditService>;

  const event = {
    eventId: 'event-1',
    occurredAt: '2026-10-01T12:00:00.000Z',
    schemaVersion: 1,
    service: 'trip-service',
    action: AuditActionEnum.CREATED,
    entity: { type: AuditEntityTypeEnum.TRIP, id: 42 },
    actor: { type: AuditActorTypeEnum.SYSTEM, id: null, role: null },
    changes: null,
    metadata: null,
  };

  const payload = (topic: string, value: unknown): EachMessagePayload =>
    ({
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
    }) as unknown as EachMessagePayload;

  // handleMessage is private, but it is the whole contract of this class;
  // reaching it through the public surface would need a broker.
  const handle = (topic: string, value: unknown) =>
    (
      service as unknown as {
        handleMessage(p: EachMessagePayload): Promise<void>;
      }
    ).handleMessage(payload(topic, value));

  beforeEach(() => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('value'),
    } as unknown as ConfigService;

    auditService = {
      record: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AuditService>;

    service = new KafkaConsumerService(configService, auditService);
  });

  it('records a complete event', async () => {
    await handle(AuditKafkaTopic.ACTION_RECORDED, event);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining(event),
    );
  });

  it('ignores a topic it has no handler for', async () => {
    await handle('auth.user-register', event);

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty message', null],
    ['invalid JSON', '{not json'],
    ['a JSON value that is not an object', 'null'],
    ['a JSON array', [event]],
    ['an occurredAt that is not a date', { ...event, occurredAt: 'yesterday' }],
    [
      'an entity id too large for Postgres',
      { ...event, entity: { type: 'TRIP', id: 99999999999 } },
    ],
    ['no eventId', { ...event, eventId: undefined }],
    ['no occurredAt', { ...event, occurredAt: undefined }],
    ['no action', { ...event, action: undefined }],
    [
      'a non-integer entity id',
      { ...event, entity: { type: 'TRIP', id: '42' } },
    ],
    ['no actor', { ...event, actor: undefined }],
    [
      'a non-integer actor id',
      { ...event, actor: { type: 'USER', id: 'seven', role: null } },
    ],
  ])('skips a message with %s', async (_case, value) => {
    await expect(
      handle(AuditKafkaTopic.ACTION_RECORDED, value),
    ).resolves.toBeUndefined();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('logs which field made a message unusable', async () => {
    const logger = (service as unknown as { logger: { error: jest.Mock } })
      .logger;
    const error = jest.spyOn(logger, 'error').mockImplementation();

    await handle(AuditKafkaTopic.ACTION_RECORDED, {
      ...event,
      actor: { type: 'USER', id: 'seven', role: null },
    });

    expect(error).toHaveBeenCalledWith(expect.stringContaining('actor.id:'));
  });

  it('rethrows a recording failure so the offset is not committed', async () => {
    auditService.record.mockRejectedValue(new Error('database down'));

    await expect(
      handle(AuditKafkaTopic.ACTION_RECORDED, event),
    ).rejects.toThrow('database down');
  });
});

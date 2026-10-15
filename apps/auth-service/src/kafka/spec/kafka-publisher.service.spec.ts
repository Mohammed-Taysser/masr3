import { AuthKafkaTopic, KafkaProducerService } from '@masr3/libs/kafka';

import KafkaPublisherService from '../kafka-publisher.service';

const payload = {
  userId: 5,
  email: 'mona@masr3.local',
  firstName: 'Mona',
  resetToken: 'raw-reset-token',
  expiresAt: '2026-10-15T09:00:00.000Z',
};

describe('KafkaPublisherService', () => {
  let publisher: KafkaPublisherService;
  let producer: jest.Mocked<KafkaProducerService>;

  beforeEach(() => {
    producer = {
      sendBatch: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<KafkaProducerService>;

    publisher = new KafkaPublisherService(producer);
  });

  it('sends the event keyed by user, with an eventId and occurredAt', async () => {
    await publisher.publish(AuthKafkaTopic.PASSWORD_RESET_REQUESTED, payload);

    const [batch] = producer.sendBatch.mock.calls[0];
    const message = batch[0].messages[0];

    expect(batch[0].topic).toBe(AuthKafkaTopic.PASSWORD_RESET_REQUESTED);
    expect(message.key).toBe('5');
    expect(JSON.parse(String(message.value))).toEqual({
      ...payload,
      eventId: expect.any(String),
      occurredAt: expect.any(String),
    });
  });

  it('logs a failed send instead of failing the request', async () => {
    producer.sendBatch.mockRejectedValue(new Error('broker down'));

    await expect(
      publisher.publish(AuthKafkaTopic.PASSWORD_RESET_REQUESTED, payload),
    ).resolves.toBeUndefined();
  });
});

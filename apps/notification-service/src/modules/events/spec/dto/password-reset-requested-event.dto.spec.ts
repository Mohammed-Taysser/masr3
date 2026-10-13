import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import PasswordResetRequestedEventDto from '../../dto/password-reset-requested-event.dto';

const event = {
  eventId: 'event-1',
  occurredAt: '2026-10-01T12:00:00.000Z',
  userId: 1,
  email: 'demo@example.com',
  firstName: 'Demo',
  resetToken: 'raw-reset-token',
  expiresAt: '2026-10-01T12:10:00.000Z',
};

const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(PasswordResetRequestedEventDto, plain)).map(
    (error) => error.property,
  );

describe('PasswordResetRequestedEventDto', () => {
  it('accepts a complete event', () => {
    expect(errorsFor(event)).toEqual([]);
  });

  it.each([
    ['userId', '1'],
    ['email', ''],
    ['firstName', undefined],
    ['resetToken', ''],
    ['expiresAt', 'in ten minutes'],
  ])('rejects %s = %p', (property, value) => {
    expect(errorsFor({ ...event, [property]: value })).toContain(property);
  });
});

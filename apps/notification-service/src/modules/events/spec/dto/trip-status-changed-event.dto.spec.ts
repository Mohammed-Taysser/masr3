import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import TripStatusChangedEventDto from '../../dto/trip-status-changed-event.dto';

const event = {
  eventId: 'event-2',
  occurredAt: '2026-10-01T12:00:00.000Z',
  tripId: 7,
  type: 'RIDE',
  customerId: 1,
  driverId: null,
  fromStatus: null,
  toStatus: 'REQUESTED',
  actor: 'CUSTOMER',
  actorId: 1,
  reason: null,
  pickupAddress: 'Tahrir Square',
  dropoffAddress: 'Zamalek',
  proposedFare: 85.5,
  agreedFare: null,
  currency: 'EGP',
};

const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(TripStatusChangedEventDto, plain)).map(
    (error) => error.property,
  );

describe('TripStatusChangedEventDto', () => {
  it('accepts a creation event, with no driver, fromStatus or agreed fare', () => {
    expect(errorsFor(event)).toEqual([]);
  });

  it('accepts a status, type or actor it does not know yet', () => {
    expect(
      errorsFor({
        ...event,
        toStatus: 'PAUSED',
        type: 'FREIGHT',
        actor: 'BOT',
      }),
    ).toEqual([]);
  });

  it.each([
    ['eventId', undefined],
    ['occurredAt', 'now'],
    ['tripId', '7'],
    ['customerId', 0],
    ['driverId', 'two'],
    ['toStatus', ''],
    ['pickupAddress', undefined],
    ['proposedFare', '85.5'],
    ['agreedFare', 'free'],
    ['currency', 'EURO'],
  ])('rejects %s = %p', (property, value) => {
    expect(errorsFor({ ...event, [property]: value })).toContain(property);
  });
});

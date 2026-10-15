import { AuthenticatedUser, ROLES_KEY, UserRoleEnum } from '@masr3/libs/auth';
import { TripActorEnum, TripStatusEnum } from '@masr3/libs/kafka';

import TripController from '../trip.controller';
import TripService from '../trip.service';

const user = (role: UserRoleEnum, id: number) =>
  ({ id, role, email: 'x@masr3.local', tokenVersion: 0 }) as AuthenticatedUser;

const rolesOf = (controller: object, method: string) =>
  Reflect.getMetadata(
    ROLES_KEY,
    (controller as Record<string, unknown>)[method] as object,
  );

describe('TripController', () => {
  let controller: TripController;
  let tripService: jest.Mocked<TripService>;

  beforeEach(() => {
    tripService = {
      create: jest.fn(),
      listMine: jest.fn(),
      listOpen: jest.fn(),
      findVisibleTrip: jest.fn(),
      findHistoryFor: jest.fn(),
      transition: jest.fn(),
    } as unknown as jest.Mocked<TripService>;

    controller = new TripController(tripService);
  });

  it.each([
    ['create', [UserRoleEnum.CUSTOMER]],
    ['listMine', [UserRoleEnum.CUSTOMER, UserRoleEnum.DRIVER]],
    ['listOpen', [UserRoleEnum.DRIVER]],
    ['findOne', undefined],
    ['findHistory', undefined],
    [
      'cancel',
      [UserRoleEnum.CUSTOMER, UserRoleEnum.DRIVER, UserRoleEnum.ADMIN],
    ],
    ['arrived', [UserRoleEnum.DRIVER]],
    ['start', [UserRoleEnum.DRIVER]],
    ['complete', [UserRoleEnum.DRIVER]],
  ])('%s requires roles %p', (method, roles) => {
    expect(rolesOf(TripController.prototype, method)).toEqual(roles);
  });

  it('creates the trip for the calling customer', async () => {
    await controller.create(user(UserRoleEnum.CUSTOMER, 3), {
      proposedFare: 50,
    } as never);

    expect(tripService.create).toHaveBeenCalledWith({
      proposedFare: 50,
      customerId: 3,
    });
  });

  it.each([
    [UserRoleEnum.CUSTOMER, TripActorEnum.CUSTOMER],
    [UserRoleEnum.DRIVER, TripActorEnum.DRIVER],
    [UserRoleEnum.ADMIN, TripActorEnum.ADMIN],
  ])('cancels as a %s with actor %s', async (role, actor) => {
    await controller.cancel(user(role, 4), 7, { reason: 'changed plans' });

    expect(tripService.transition).toHaveBeenCalledWith({
      tripId: 7,
      to: TripStatusEnum.CANCELLED,
      actor,
      actorId: 4,
      reason: 'changed plans',
    });
  });

  it.each([
    ['arrived', TripStatusEnum.DRIVER_ARRIVED],
    ['start', TripStatusEnum.IN_PROGRESS],
    ['complete', TripStatusEnum.COMPLETED],
  ] as const)('%s moves the trip to %s as the driver', async (method, to) => {
    await controller[method](user(UserRoleEnum.DRIVER, 5), 7);

    expect(tripService.transition).toHaveBeenCalledWith({
      tripId: 7,
      to,
      actor: TripActorEnum.DRIVER,
      actorId: 5,
    });
  });
});

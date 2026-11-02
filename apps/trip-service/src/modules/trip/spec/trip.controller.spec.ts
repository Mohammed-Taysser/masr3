import { AuthenticatedUser, ROLES_KEY, UserRoleEnum } from '@masr3/libs/auth';
import { TripStatusEnum } from '@masr3/libs/kafka';
import { VehicleTypeEnum } from '@masr3/libs/vehicle';

import { TripListScopeEnum } from '../trip.enum';
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
      list: jest.fn(),
      findVisibleTrip: jest.fn(),
      findHistoryFor: jest.fn(),
      updateRequestedVehicleType: jest.fn(),
      transitionAs: jest.fn(),
    } as unknown as jest.Mocked<TripService>;

    controller = new TripController(tripService);
  });

  it.each([
    ['create', [UserRoleEnum.CUSTOMER, UserRoleEnum.ADMIN]],
    ['list', [UserRoleEnum.ADMIN]],
    ['listMine', [UserRoleEnum.CUSTOMER, UserRoleEnum.DRIVER]],
    ['listOpen', [UserRoleEnum.DRIVER, UserRoleEnum.ADMIN]],
    ['findOne', undefined],
    ['findHistory', undefined],
    ['updateRequestedVehicleType', [UserRoleEnum.CUSTOMER, UserRoleEnum.ADMIN]],
    [
      'cancel',
      [UserRoleEnum.CUSTOMER, UserRoleEnum.DRIVER, UserRoleEnum.ADMIN],
    ],
    ['arrived', [UserRoleEnum.DRIVER, UserRoleEnum.ADMIN]],
    ['start', [UserRoleEnum.DRIVER, UserRoleEnum.ADMIN]],
    ['complete', [UserRoleEnum.DRIVER, UserRoleEnum.ADMIN]],
  ])('%s requires roles %p', (method, roles) => {
    expect(rolesOf(TripController.prototype, method)).toEqual(roles);
  });

  it('passes the body and the caller to create', async () => {
    const caller = user(UserRoleEnum.ADMIN, 9);
    const dto = { proposedFare: 50, customerId: 3 } as never;

    await controller.create(caller, dto);

    expect(tripService.create).toHaveBeenCalledWith(dto, caller);
  });

  it.each([
    ['list', TripListScopeEnum.ALL],
    ['listMine', TripListScopeEnum.MINE],
    ['listOpen', TripListScopeEnum.OPEN],
  ] as const)('%s lists with scope %s', async (method, scope) => {
    const caller = user(UserRoleEnum.ADMIN, 9);
    const query = { page: 1, limit: 20 };

    await controller[method](caller, query);

    expect(tripService.list).toHaveBeenCalledWith(query, caller, scope);
  });

  it('changes the requested vehicle type as the caller', async () => {
    const caller = user(UserRoleEnum.CUSTOMER, 3);
    const dto = { requestedVehicleType: VehicleTypeEnum.CAR };

    await controller.updateRequestedVehicleType(caller, 7, dto);

    expect(tripService.updateRequestedVehicleType).toHaveBeenCalledWith(
      7,
      dto,
      caller,
    );
  });

  it('cancels as the caller, with the reason', async () => {
    const caller = user(UserRoleEnum.ADMIN, 4);

    await controller.cancel(caller, 7, { reason: 'changed plans' });

    expect(tripService.transitionAs).toHaveBeenCalledWith(
      7,
      TripStatusEnum.CANCELLED,
      caller,
      'changed plans',
    );
  });

  it.each([
    ['arrived', TripStatusEnum.DRIVER_ARRIVED],
    ['start', TripStatusEnum.IN_PROGRESS],
    ['complete', TripStatusEnum.COMPLETED],
  ] as const)('%s moves the trip to %s as the caller', async (method, to) => {
    const caller = user(UserRoleEnum.DRIVER, 5);

    await controller[method](caller, 7);

    expect(tripService.transitionAs).toHaveBeenCalledWith(7, to, caller);
  });
});

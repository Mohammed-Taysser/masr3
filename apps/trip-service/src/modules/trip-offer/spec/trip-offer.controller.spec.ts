import { AuthenticatedUser, ROLES_KEY, UserRoleEnum } from '@masr3/libs/auth';

import TripOfferController from '../trip-offer.controller';
import TripOfferService from '../trip-offer.service';

const user = (role: UserRoleEnum, id: number) =>
  ({ id, role, email: 'x@masr3.local', tokenVersion: 0 }) as AuthenticatedUser;

const rolesOf = (controller: object, method: string) =>
  Reflect.getMetadata(
    ROLES_KEY,
    (controller as Record<string, unknown>)[method] as object,
  );

describe('TripOfferController', () => {
  let controller: TripOfferController;
  let tripOfferService: jest.Mocked<TripOfferService>;

  beforeEach(() => {
    tripOfferService = {
      create: jest.fn(),
      listForTrip: jest.fn(),
      accept: jest.fn(),
      withdraw: jest.fn(),
    } as unknown as jest.Mocked<TripOfferService>;

    controller = new TripOfferController(tripOfferService);
  });

  it.each([
    ['create', [UserRoleEnum.DRIVER, UserRoleEnum.ADMIN]],
    ['list', [UserRoleEnum.CUSTOMER, UserRoleEnum.ADMIN]],
    ['accept', [UserRoleEnum.CUSTOMER, UserRoleEnum.ADMIN]],
    ['withdraw', [UserRoleEnum.DRIVER, UserRoleEnum.ADMIN]],
  ])('%s requires roles %p', (method, roles) => {
    expect(rolesOf(TripOfferController.prototype, method)).toEqual(roles);
  });

  it('makes the offer with the body, as the caller', async () => {
    const admin = user(UserRoleEnum.ADMIN, 9);
    const dto = { amount: 90, driverId: 5 };

    await controller.create(admin, 7, dto);

    expect(tripOfferService.create).toHaveBeenCalledWith(7, dto, admin);
  });

  it('accepts as the caller', async () => {
    const customer = user(UserRoleEnum.CUSTOMER, 1);

    await controller.accept(customer, 7, 12);

    expect(tripOfferService.accept).toHaveBeenCalledWith(7, 12, customer);
  });

  it('withdraws as the caller', async () => {
    const admin = user(UserRoleEnum.ADMIN, 9);

    await controller.withdraw(admin, 7, 12);

    expect(tripOfferService.withdraw).toHaveBeenCalledWith(7, 12, admin);
  });
});

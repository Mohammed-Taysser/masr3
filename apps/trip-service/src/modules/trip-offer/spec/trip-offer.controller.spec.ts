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
    ['create', [UserRoleEnum.DRIVER]],
    ['list', [UserRoleEnum.CUSTOMER, UserRoleEnum.ADMIN]],
    ['accept', [UserRoleEnum.CUSTOMER]],
    ['withdraw', [UserRoleEnum.DRIVER]],
  ])('%s requires roles %p', (method, roles) => {
    expect(rolesOf(TripOfferController.prototype, method)).toEqual(roles);
  });

  it('makes the offer as the calling driver', async () => {
    const driver = user(UserRoleEnum.DRIVER, 5);

    await controller.create(driver, 7, { amount: 90 });

    expect(tripOfferService.create).toHaveBeenCalledWith(7, driver, 90);
  });

  it('accepts as the calling customer', async () => {
    const customer = user(UserRoleEnum.CUSTOMER, 1);

    await controller.accept(customer, 7, 12);

    expect(tripOfferService.accept).toHaveBeenCalledWith(7, 12, customer);
  });
});

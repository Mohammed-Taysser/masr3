import { AuthenticatedUser, ROLES_KEY, UserRoleEnum } from '@masr3/libs/auth';

import CreateVehicleDto from '../dto/create-vehicle.dto';
import ListVehiclesQueryDto from '../dto/list-vehicles-query.dto';
import VehicleController from '../vehicle.controller';
import {
  VehicleOperationalStatusEnum,
  VehicleVerificationStatusEnum,
} from '../vehicle.enum';
import VehicleService from '../vehicle.service';

describe('VehicleController', () => {
  let controller: VehicleController;
  let service: jest.Mocked<VehicleService>;

  const user: AuthenticatedUser = {
    id: 5,
    email: 'driver@masr3.local',
    role: UserRoleEnum.DRIVER,
    tokenVersion: 0,
  };

  const rolesOf = (method: keyof VehicleController) =>
    Reflect.getMetadata(ROLES_KEY, VehicleController.prototype[method]);

  beforeEach(() => {
    service = {
      create: jest.fn(),
      list: jest.fn(),
      listMine: jest.fn(),
      findVisible: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      changeVerificationStatus: jest.fn(),
      changeOperationalStatus: jest.fn(),
    } as unknown as jest.Mocked<VehicleService>;

    controller = new VehicleController(service);
  });

  it('passes the caller to every user route', async () => {
    const dto = {} as CreateVehicleDto;
    const query = {} as ListVehiclesQueryDto;

    await controller.create(user, dto);
    await controller.listMine(user, query);
    await controller.findOne(user, 12);
    await controller.update(user, 12, {});
    await controller.remove(user, 12);

    expect(service.create).toHaveBeenCalledWith(dto, user);
    expect(service.listMine).toHaveBeenCalledWith(user, query);
    expect(service.findVisible).toHaveBeenCalledWith(12, user);
    expect(service.update).toHaveBeenCalledWith(12, {}, user);
    expect(service.remove).toHaveBeenCalledWith(12, user);
  });

  it('passes both status changes through', async () => {
    const verification = { status: VehicleVerificationStatusEnum.APPROVED };
    const operational = { status: VehicleOperationalStatusEnum.ACTIVE };

    await controller.changeVerificationStatus(user, 12, verification);
    await controller.changeOperationalStatus(user, 12, operational);

    expect(service.changeVerificationStatus).toHaveBeenCalledWith(
      12,
      verification,
      user,
    );
    expect(service.changeOperationalStatus).toHaveBeenCalledWith(
      12,
      operational,
      user,
    );
  });

  it.each([
    'list',
    'changeVerificationStatus',
    'changeOperationalStatus',
  ] as const)('restricts %s to admins', (method) => {
    expect(rolesOf(method)).toEqual([UserRoleEnum.ADMIN]);
  });

  it.each(['create', 'findOne', 'update', 'remove'] as const)(
    'opens %s to drivers and admins',
    (method) => {
      expect(rolesOf(method)).toEqual([
        UserRoleEnum.DRIVER,
        UserRoleEnum.ADMIN,
      ]);
    },
  );

  it('opens listMine to drivers only', () => {
    expect(rolesOf('listMine')).toEqual([UserRoleEnum.DRIVER]);
  });
});

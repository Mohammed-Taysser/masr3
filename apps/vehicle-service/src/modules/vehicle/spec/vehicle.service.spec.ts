import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  ILike,
  Not,
  QueryFailedError,
  Repository,
} from 'typeorm';

import { AuthenticatedUser, UserRoleEnum } from '@masr3/libs/auth';
import {
  AuditActionEnum,
  AuditEntityTypeEnum,
  buildAuditChanges,
  buildUserAuditActor,
} from '@masr3/libs/kafka';

import AuditRecorderService from '../../audit/audit-recorder.service';
import DriverService from '../../driver/driver.service';
import CreateVehicleDto from '../dto/create-vehicle.dto';
import ListVehiclesQueryDto from '../dto/list-vehicles-query.dto';
import VehicleEntity from '../entities/vehicle.entity';
import {
  UQ_VEHICLES_PLATE_NUMBER,
  VEHICLE_AUDITED_FIELDS,
} from '../vehicle.constant';
import {
  VehicleOperationalStatusEnum,
  VehicleTypeEnum,
  VehicleVerificationStatusEnum,
} from '../vehicle.enum';
import VehicleService from '../vehicle.service';

describe('VehicleService', () => {
  let service: VehicleService;
  let repository: jest.Mocked<Repository<VehicleEntity>>;
  let manager: jest.Mocked<EntityManager>;
  let auditRecorder: jest.Mocked<AuditRecorderService>;
  let driverService: jest.Mocked<DriverService>;

  const driver: AuthenticatedUser = {
    id: 5,
    email: 'driver@masr3.local',
    role: UserRoleEnum.DRIVER,
    tokenVersion: 0,
  };

  const admin: AuthenticatedUser = {
    id: 1,
    email: 'admin@masr3.local',
    role: UserRoleEnum.ADMIN,
    tokenVersion: 0,
  };

  const vehicle = {
    id: 12,
    driverId: 5,
    driver: null,
    type: VehicleTypeEnum.CAR,
    manufacturer: 'Toyota',
    model: 'Corolla',
    year: 2022,
    plateNumber: 'ABC 1234',
    color: null,
    verificationStatus: VehicleVerificationStatusEnum.PENDING,
    operationalStatus: VehicleOperationalStatusEnum.INACTIVE,
    isDefault: false,
  } as VehicleEntity;

  const createDto = {
    type: VehicleTypeEnum.CAR,
    manufacturer: 'Toyota',
    model: 'Corolla',
    year: 2022,
    plateNumber: 'ABC 1234',
  } as CreateVehicleDto;

  const uniqueViolation = (constraint: string) =>
    new QueryFailedError('INSERT', [], {
      code: '23505',
      constraint,
    } as unknown as Error);

  beforeEach(() => {
    repository = {
      findOne: jest.fn().mockResolvedValue(vehicle),
      findAndCount: jest.fn().mockResolvedValue([[vehicle], 1]),
    } as unknown as jest.Mocked<Repository<VehicleEntity>>;

    manager = {
      findOne: jest.fn().mockResolvedValue(vehicle),
      findOneByOrFail: jest.fn().mockResolvedValue(vehicle),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_entity, values) => values),
      save: jest.fn().mockResolvedValue(vehicle),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    const dataSource = {
      transaction: jest.fn((work: (m: EntityManager) => unknown) =>
        work(manager),
      ),
    } as unknown as DataSource;

    auditRecorder = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditRecorderService>;

    driverService = {
      findActiveOrFail: jest.fn(),
    } as unknown as jest.Mocked<DriverService>;

    service = new VehicleService(
      repository,
      dataSource,
      auditRecorder,
      driverService,
    );
  });

  describe('list', () => {
    const query = (overrides: Partial<ListVehiclesQueryDto> = {}) =>
      ({ page: 2, limit: 10, ...overrides }) as ListVehiclesQueryDto;

    it('pages through vehicles with their driver, newest first', async () => {
      const result = await service.list(query());

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: [{}],
        relations: { driver: true },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: 10,
        take: 10,
      });
      expect(result.meta.total).toBe(1);
    });

    it('searches plate, make, model and driver name under the filters', async () => {
      await service.list(
        query({
          search: 'toy',
          type: VehicleTypeEnum.CAR,
          verificationStatus: VehicleVerificationStatusEnum.APPROVED,
        }),
      );

      const filters = {
        type: VehicleTypeEnum.CAR,
        verificationStatus: VehicleVerificationStatusEnum.APPROVED,
      };
      const pattern = ILike('%toy%');

      expect(repository.findAndCount.mock.calls[0][0]?.where).toEqual([
        { ...filters, plateNumber: pattern },
        { ...filters, manufacturer: pattern },
        { ...filters, model: pattern },
        { ...filters, driver: { firstName: pattern } },
        { ...filters, driver: { lastName: pattern } },
      ]);
    });

    it("limits a driver's list to their own vehicles", async () => {
      await service.listMine(driver, query({ driverId: 99 }));

      expect(repository.findAndCount.mock.calls[0][0]?.where).toEqual([
        { driverId: 5 },
      ]);
    });
  });

  describe('findVisible', () => {
    it("hides another driver's vehicle as not found", async () => {
      await expect(
        service.findVisible(12, { ...driver, id: 6 }),
      ).rejects.toThrow(new NotFoundException('Vehicle 12 not found'));
    });

    it('shows any vehicle to an admin', async () => {
      await expect(service.findVisible(12, admin)).resolves.toBe(vehicle);
    });
  });

  describe('create', () => {
    it("adds the driver's own vehicle and audits it", async () => {
      await service.create(createDto, driver);

      expect(driverService.findActiveOrFail).toHaveBeenCalledWith(5);
      expect(manager.create).toHaveBeenCalledWith(VehicleEntity, {
        ...createDto,
        driverId: 5,
      });
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.CREATED,
        entity: { type: AuditEntityTypeEnum.VEHICLE, id: 12 },
        actor: buildUserAuditActor(driver),
        changes: buildAuditChanges(null, vehicle, VEHICLE_AUDITED_FIELDS),
        metadata: null,
      });
    });

    it('checks the driver an admin names', async () => {
      await service.create({ ...createDto, driverId: 7 }, admin);

      expect(driverService.findActiveOrFail).toHaveBeenCalledWith(7);
      expect(manager.create).toHaveBeenCalledWith(
        VehicleEntity,
        expect.objectContaining({ driverId: 7 }),
      );
    });

    it('writes nothing for an unknown driver', async () => {
      driverService.findActiveOrFail.mockRejectedValue(
        new NotFoundException('Driver 5 not found'),
      );

      await expect(service.create(createDto, driver)).rejects.toThrow(
        NotFoundException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('clears the previous default, audited, before saving a new default', async () => {
      const previous = { ...vehicle, id: 3, isDefault: true } as VehicleEntity;

      manager.find.mockResolvedValue([previous]);

      await service.create({ ...createDto, isDefault: true }, driver);

      expect(manager.find).toHaveBeenCalledWith(VehicleEntity, {
        where: { driverId: 5, isDefault: true },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.update).toHaveBeenCalledWith(
        VehicleEntity,
        { id: 3 },
        { isDefault: false },
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          action: AuditActionEnum.UPDATED,
          entity: { type: AuditEntityTypeEnum.VEHICLE, id: 3 },
          changes: { isDefault: { old: true, new: false } },
        }),
      );
    });

    it('answers a taken plate number with 409', async () => {
      manager.save.mockRejectedValue(uniqueViolation(UQ_VEHICLES_PLATE_NUMBER));

      await expect(service.create(createDto, driver)).rejects.toThrow(
        new ConflictException('Plate number ABC 1234 is already registered'),
      );
    });
  });

  describe('update', () => {
    it('updates the locked row and audits the diff', async () => {
      const after = { ...vehicle, color: 'White' } as VehicleEntity;

      manager.findOneByOrFail.mockResolvedValue(after);

      await service.update(12, { color: 'White' }, driver);

      expect(manager.findOne).toHaveBeenCalledWith(VehicleEntity, {
        where: { id: 12 },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.update).toHaveBeenCalledWith(
        VehicleEntity,
        { id: 12 },
        { color: 'White' },
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.UPDATED,
        entity: { type: AuditEntityTypeEnum.VEHICLE, id: 12 },
        actor: buildUserAuditActor(driver),
        changes: { color: { old: null, new: 'White' } },
        metadata: null,
      });
    });

    it('records no audit when nothing changed', async () => {
      await service.update(12, { color: null }, driver);

      expect(auditRecorder.record).not.toHaveBeenCalled();
    });

    it('clears the other default when this vehicle becomes the default', async () => {
      await service.update(12, { isDefault: true }, driver);

      expect(manager.find).toHaveBeenCalledWith(VehicleEntity, {
        where: { driverId: 5, isDefault: true, id: Not(12) },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it("refuses another driver's vehicle without writing", async () => {
      await expect(
        service.update(12, { color: 'White' }, { ...driver, id: 6 }),
      ).rejects.toThrow(NotFoundException);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('returns the vehicle unchanged for an empty body', async () => {
      await expect(service.update(12, {}, driver)).resolves.toBe(vehicle);
      expect(manager.findOne).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the locked row and audits it', async () => {
      await service.remove(12, admin);

      expect(manager.delete).toHaveBeenCalledWith(VehicleEntity, { id: 12 });
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.DELETED,
        entity: { type: AuditEntityTypeEnum.VEHICLE, id: 12 },
        actor: buildUserAuditActor(admin),
        changes: buildAuditChanges(vehicle, null, VEHICLE_AUDITED_FIELDS),
        metadata: null,
      });
    });
  });

  describe('status changes', () => {
    it('approves a PENDING vehicle and audits STATUS_CHANGED with the reason', async () => {
      const approved = {
        ...vehicle,
        verificationStatus: VehicleVerificationStatusEnum.APPROVED,
      } as VehicleEntity;

      manager.findOneByOrFail.mockResolvedValue(approved);

      await service.changeVerificationStatus(
        12,
        { status: VehicleVerificationStatusEnum.APPROVED, reason: 'Checked' },
        admin,
      );

      expect(manager.update).toHaveBeenCalledWith(
        VehicleEntity,
        { id: 12 },
        { verificationStatus: VehicleVerificationStatusEnum.APPROVED },
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.STATUS_CHANGED,
        entity: { type: AuditEntityTypeEnum.VEHICLE, id: 12 },
        actor: buildUserAuditActor(admin),
        changes: {
          verificationStatus: {
            old: VehicleVerificationStatusEnum.PENDING,
            new: VehicleVerificationStatusEnum.APPROVED,
          },
        },
        metadata: { reason: 'Checked' },
      });
    });

    it('writes nothing when the move is not allowed', async () => {
      await expect(
        service.changeOperationalStatus(
          12,
          { status: VehicleOperationalStatusEnum.ACTIVE },
          admin,
        ),
      ).rejects.toThrow(ConflictException);

      expect(manager.update).not.toHaveBeenCalled();
      expect(auditRecorder.record).not.toHaveBeenCalled();
    });

    it('activates an APPROVED vehicle with a null reason', async () => {
      manager.findOne.mockResolvedValue({
        ...vehicle,
        verificationStatus: VehicleVerificationStatusEnum.APPROVED,
      } as VehicleEntity);

      await service.changeOperationalStatus(
        12,
        { status: VehicleOperationalStatusEnum.ACTIVE },
        admin,
      );

      expect(manager.update).toHaveBeenCalledWith(
        VehicleEntity,
        { id: 12 },
        { operationalStatus: VehicleOperationalStatusEnum.ACTIVE },
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ metadata: { reason: null } }),
      );
    });

    it('answers a missing vehicle with 404', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.changeVerificationStatus(
          12,
          { status: VehicleVerificationStatusEnum.APPROVED },
          admin,
        ),
      ).rejects.toThrow(new NotFoundException('Vehicle 12 not found'));
    });
  });
});

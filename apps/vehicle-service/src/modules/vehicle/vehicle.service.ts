import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  ILike,
  Not,
  QueryDeepPartialEntity,
  Repository,
} from 'typeorm';

import { AuthenticatedUser } from '@masr3/libs/auth';
import { isUniqueViolation } from '@masr3/libs/database';
import {
  AuditActionEnum,
  AuditActor,
  AuditEntityTypeEnum,
  buildAuditChanges,
  buildUserAuditActor,
} from '@masr3/libs/kafka';
import { paginate, Paginated, paginationWindow } from '@masr3/libs/pagination';

import AuditRecorderService from '../audit/audit-recorder.service';
import DriverService from '../driver/driver.service';
import CreateVehicleDto from './dto/create-vehicle.dto';
import ListVehiclesQueryDto from './dto/list-vehicles-query.dto';
import UpdateOperationalStatusDto from './dto/update-operational-status.dto';
import UpdateVehicleDto from './dto/update-vehicle.dto';
import UpdateVerificationStatusDto from './dto/update-verification-status.dto';
import VehicleEntity from './entities/vehicle.entity';
import {
  UQ_VEHICLES_DRIVER_DEFAULT,
  UQ_VEHICLES_PLATE_NUMBER,
  VEHICLE_AUDITED_FIELDS,
} from './vehicle.constant';
import {
  assertOperationalTransition,
  assertVerificationTransition,
  canAccessVehicle,
  resolveDriverId,
} from './vehicle.policy';

@Injectable()
class VehicleService {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
    private readonly dataSource: DataSource,
    private readonly auditRecorder: AuditRecorderService,
    private readonly driverService: DriverService,
  ) {}

  async list(query: ListVehiclesQueryDto): Promise<Paginated<VehicleEntity>> {
    return this.findPage(VehicleService.prepareListWhere(query), query);
  }

  async listMine(
    user: AuthenticatedUser,
    query: ListVehiclesQueryDto,
  ): Promise<Paginated<VehicleEntity>> {
    return this.findPage(
      VehicleService.prepareListWhere({ ...query, driverId: user.id }),
      query,
    );
  }

  async findVisible(
    id: number,
    user: AuthenticatedUser,
  ): Promise<VehicleEntity> {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
      relations: { driver: true },
    });

    if (!vehicle || !canAccessVehicle(vehicle, user)) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    return vehicle;
  }

  async create(
    dto: CreateVehicleDto,
    user: AuthenticatedUser,
  ): Promise<VehicleEntity> {
    const driverId = resolveDriverId(user, dto.driverId);
    const actor = buildUserAuditActor(user);

    await this.driverService.findActiveOrFail(driverId);

    let id: number;

    try {
      id = await this.dataSource.transaction(async (manager) => {
        if (dto.isDefault) {
          await this.clearDefault(manager, driverId, null, actor);
        }

        const vehicle = await manager.save(
          manager.create(VehicleEntity, { ...dto, driverId }),
        );

        await this.auditRecorder.record(manager, {
          action: AuditActionEnum.CREATED,
          entity: { type: AuditEntityTypeEnum.VEHICLE, id: vehicle.id },
          actor,
          changes: buildAuditChanges(null, vehicle, VEHICLE_AUDITED_FIELDS),
          metadata: null,
        });

        return vehicle.id;
      });
    } catch (error) {
      if (isUniqueViolation(error, UQ_VEHICLES_PLATE_NUMBER)) {
        throw new ConflictException(
          `Plate number ${dto.plateNumber} is already registered`,
        );
      }

      if (isUniqueViolation(error, UQ_VEHICLES_DRIVER_DEFAULT)) {
        throw new ConflictException(
          'Another default vehicle was set at the same time; try again',
        );
      }

      throw error;
    }

    return this.findVisible(id, user);
  }

  async update(
    id: number,
    dto: UpdateVehicleDto,
    user: AuthenticatedUser,
  ): Promise<VehicleEntity> {
    if (Object.keys(dto).length === 0) {
      return this.findVisible(id, user);
    }

    const actor = buildUserAuditActor(user);

    try {
      await this.dataSource.transaction(async (manager) => {
        const before = await VehicleService.lockVisibleOrFail(
          manager,
          id,
          user,
        );

        if (dto.isDefault) {
          await this.clearDefault(manager, before.driverId, id, actor);
        }

        await manager.update(VehicleEntity, { id }, { ...dto });

        const after = await manager.findOneByOrFail(VehicleEntity, { id });
        const changes = buildAuditChanges(
          before,
          after,
          VEHICLE_AUDITED_FIELDS,
        );

        if (changes) {
          await this.auditRecorder.record(manager, {
            action: AuditActionEnum.UPDATED,
            entity: { type: AuditEntityTypeEnum.VEHICLE, id },
            actor,
            changes,
            metadata: null,
          });
        }
      });
    } catch (error) {
      if (isUniqueViolation(error, UQ_VEHICLES_PLATE_NUMBER)) {
        throw new ConflictException(
          `Plate number ${dto.plateNumber} is already registered`,
        );
      }

      if (isUniqueViolation(error, UQ_VEHICLES_DRIVER_DEFAULT)) {
        throw new ConflictException(
          'Another default vehicle was set at the same time; try again',
        );
      }

      throw error;
    }

    return this.findVisible(id, user);
  }

  async remove(id: number, user: AuthenticatedUser): Promise<VehicleEntity> {
    return this.dataSource.transaction(async (manager) => {
      const vehicle = await VehicleService.lockVisibleOrFail(manager, id, user);

      await manager.delete(VehicleEntity, { id });

      await this.auditRecorder.record(manager, {
        action: AuditActionEnum.DELETED,
        entity: { type: AuditEntityTypeEnum.VEHICLE, id },
        actor: buildUserAuditActor(user),
        changes: buildAuditChanges(vehicle, null, VEHICLE_AUDITED_FIELDS),
        metadata: null,
      });

      return vehicle;
    });
  }

  async changeVerificationStatus(
    id: number,
    dto: UpdateVerificationStatusDto,
    user: AuthenticatedUser,
  ): Promise<VehicleEntity> {
    return this.changeStatus(id, dto.reason ?? null, user, (vehicle) => {
      assertVerificationTransition(vehicle, dto.status);

      return { verificationStatus: dto.status };
    });
  }

  async changeOperationalStatus(
    id: number,
    dto: UpdateOperationalStatusDto,
    user: AuthenticatedUser,
  ): Promise<VehicleEntity> {
    return this.changeStatus(id, dto.reason ?? null, user, (vehicle) => {
      assertOperationalTransition(vehicle, dto.status);

      return { operationalStatus: dto.status };
    });
  }

  // The only place a vehicle's status is written: lock the row, validate the
  // move against the locked state, update, and audit it in the same
  // transaction. A second admin waits on the lock and is validated against
  // what the first one wrote. The audit entry (with the reason) is the
  // vehicle's status history.
  private async changeStatus(
    id: number,
    reason: string | null,
    user: AuthenticatedUser,
    decide: (vehicle: VehicleEntity) => QueryDeepPartialEntity<VehicleEntity>,
  ): Promise<VehicleEntity> {
    await this.dataSource.transaction(async (manager) => {
      const before = await VehicleService.lockOrFail(manager, id);

      await manager.update(VehicleEntity, { id }, decide(before));

      const after = await manager.findOneByOrFail(VehicleEntity, { id });

      await this.auditRecorder.record(manager, {
        action: AuditActionEnum.STATUS_CHANGED,
        entity: { type: AuditEntityTypeEnum.VEHICLE, id },
        actor: buildUserAuditActor(user),
        changes: buildAuditChanges(before, after, VEHICLE_AUDITED_FIELDS),
        metadata: { reason },
      });
    });

    return this.findVisible(id, user);
  }

  private async findPage(
    where: FindOptionsWhere<VehicleEntity>[],
    query: ListVehiclesQueryDto,
  ): Promise<Paginated<VehicleEntity>> {
    const [items, total] = await this.vehicleRepository.findAndCount({
      where,
      relations: { driver: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      ...paginationWindow(query),
    });

    return paginate(items, total, query);
  }

  // Unsets the driver's current default (other than keepId), audited like any
  // other change. The partial unique index catches a concurrent default.
  private async clearDefault(
    manager: EntityManager,
    driverId: number,
    keepId: number | null,
    actor: AuditActor,
  ): Promise<void> {
    const defaults = await manager.find(VehicleEntity, {
      where: {
        driverId,
        isDefault: true,
        ...(keepId !== null && { id: Not(keepId) }),
      },
      lock: { mode: 'pessimistic_write' },
    });

    for (const vehicle of defaults) {
      await manager.update(
        VehicleEntity,
        { id: vehicle.id },
        { isDefault: false },
      );

      await this.auditRecorder.record(manager, {
        action: AuditActionEnum.UPDATED,
        entity: { type: AuditEntityTypeEnum.VEHICLE, id: vehicle.id },
        actor,
        changes: buildAuditChanges(
          vehicle,
          { ...vehicle, isDefault: false },
          VEHICLE_AUDITED_FIELDS,
        ),
        metadata: null,
      });
    }
  }

  private static async lockOrFail(
    manager: EntityManager,
    id: number,
  ): Promise<VehicleEntity> {
    const vehicle = await manager.findOne(VehicleEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    return vehicle;
  }

  private static async lockVisibleOrFail(
    manager: EntityManager,
    id: number,
    user: AuthenticatedUser,
  ): Promise<VehicleEntity> {
    const vehicle = await VehicleService.lockOrFail(manager, id);

    if (!canAccessVehicle(vehicle, user)) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    return vehicle;
  }

  private static prepareListWhere(
    query: ListVehiclesQueryDto,
  ): FindOptionsWhere<VehicleEntity>[] {
    const where: FindOptionsWhere<VehicleEntity> = {
      ...(query.driverId && { driverId: query.driverId }),
      ...(query.type && { type: query.type }),
      ...(query.verificationStatus && {
        verificationStatus: query.verificationStatus,
      }),
      ...(query.operationalStatus && {
        operationalStatus: query.operationalStatus,
      }),
    };

    if (!query.search) {
      return [where];
    }

    const pattern = ILike(`%${query.search}%`);

    return [
      { ...where, plateNumber: pattern },
      { ...where, manufacturer: pattern },
      { ...where, model: pattern },
      { ...where, driver: { firstName: pattern } },
      { ...where, driver: { lastName: pattern } },
    ];
  }
}

export default VehicleService;

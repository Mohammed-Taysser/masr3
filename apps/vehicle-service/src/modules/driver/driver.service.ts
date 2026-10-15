import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserRoleEnum } from '@masr3/libs/auth';
import { UserChangedEvent, UserChangeEnum } from '@masr3/libs/kafka';

import DriverEntity from './entities/driver.entity';

@Injectable()
class DriverService {
  constructor(
    @InjectRepository(DriverEntity)
    private readonly driverRepository: Repository<DriverEntity>,
  ) {}

  // Each event is the user's whole state, and auth-service's outbox keys them
  // by userId, so they arrive in order: overwriting (or deleting) the row is
  // enough, and replaying an event leaves the same row.
  async applyUserChanged(event: UserChangedEvent): Promise<void> {
    const isDriver =
      event.change !== UserChangeEnum.DELETED &&
      event.role === UserRoleEnum.DRIVER;

    if (!isDriver) {
      await this.driverRepository.delete({ userId: event.userId });

      return;
    }

    await this.driverRepository.upsert(
      {
        userId: event.userId,
        firstName: event.firstName,
        lastName: event.lastName,
        isActive: event.isActive,
      },
      { conflictPaths: ['userId'] },
    );
  }

  async findActiveOrFail(userId: number): Promise<DriverEntity> {
    const driver = await this.driverRepository.findOneBy({ userId });

    if (!driver) {
      throw new NotFoundException(`Driver ${userId} not found`);
    }

    if (!driver.isActive) {
      throw new ConflictException(`Driver ${userId} is deactivated`);
    }

    return driver;
  }
}

export default DriverService;

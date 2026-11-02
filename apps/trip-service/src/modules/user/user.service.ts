import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserRoleEnum } from '@masr3/libs/auth';
import { UserChangedEvent, UserChangeEnum } from '@masr3/libs/kafka';

import UserEntity from './entities/user.entity';
import { TRIP_PARTICIPANT_ROLES } from './user.constant';

@Injectable()
class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async findActiveOrFail(
    userId: number,
    role: UserRoleEnum,
  ): Promise<UserEntity> {
    const user = await this.userRepository.findOneBy({ userId, role });

    if (!user) {
      throw new NotFoundException(`${role} ${userId} not found`);
    }

    if (!user.isActive) {
      throw new ConflictException(`${role} ${userId} is deactivated`);
    }

    return user;
  }

  // Each event is the user's whole state, and auth-service's outbox keys them
  // by userId, so they arrive in order: overwriting (or deleting) the row is
  // enough, and replaying an event leaves the same row.
  async applyUserChanged(event: UserChangedEvent): Promise<void> {
    const isKept =
      event.change !== UserChangeEnum.DELETED &&
      TRIP_PARTICIPANT_ROLES.includes(event.role);

    if (!isKept) {
      await this.userRepository.delete({ userId: event.userId });

      return;
    }

    await this.userRepository.upsert(
      { userId: event.userId, role: event.role, isActive: event.isActive },
      { conflictPaths: ['userId'] },
    );
  }
}

export default UserService;

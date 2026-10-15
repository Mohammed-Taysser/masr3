import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  ILike,
  QueryDeepPartialEntity,
  Repository,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { dayjs } from '@masr3/libs/date';
import {
  ANONYMOUS_AUDIT_ACTOR,
  AuditActionEnum,
  AuditActor,
  AuditEntityTypeEnum,
  AuthKafkaTopic,
  buildAuditChanges,
  buildUserAuditActor,
  UserChangeEnum,
} from '@masr3/libs/kafka';
import { OutboxService } from '@masr3/libs/outbox';
import { paginate, Paginated, paginationWindow } from '@masr3/libs/pagination';

import AuditRecorderService from '../audit/audit-recorder.service';
import { OutboxEventMap } from '../../kafka/kafka.interface';

import UserEntity from './entities/user.entity';
import CreateUserDto from './dto/create-user.dto';
import { PasswordResetTokenOptions } from './users.interface';
import UpdateUserDto from './dto/update-user.dto';
import ListUsersQueryDto from './dto/list-users-query.dto';
import { USER_AUDITED_FIELDS, USER_SNAPSHOT_FIELDS } from './users.constant';
import { buildUserChangedEvent } from './user-changed.event';

@Injectable()
class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly auditRecorder: AuditRecorderService,
    private readonly outboxService: OutboxService<OutboxEventMap>,
  ) {}

  async findAll(query: ListUsersQueryDto): Promise<Paginated<UserEntity>> {
    const [items, total] = await this.userRepository.findAndCount({
      where: this.prepareListWhere(query),
      order: { [query.sortBy]: query.sortOrder, id: query.sortOrder },
      ...paginationWindow(query),
    });

    return paginate(items, total, query);
  }

  // An admin creating an account.
  async create(dto: CreateUserDto, actor: AuditActor): Promise<UserEntity> {
    return this.insert(dto, AuditActionEnum.CREATED, () => actor);
  }

  // Someone signing themselves up: the new user is their own actor.
  async register(dto: CreateUserDto): Promise<UserEntity> {
    return this.insert(dto, AuditActionEnum.REGISTERED, buildUserAuditActor);
  }

  async update(id: number, dto: UpdateUserDto, actor: AuditActor) {
    if (Object.keys(dto).length === 0) {
      return this.findByIdOrFail(id);
    }

    const values: QueryDeepPartialEntity<UserEntity> = { ...dto };

    // A role change revokes the user's tokens. The CASE reads the old role in
    // the same UPDATE, so the check cannot race another write.
    if (dto.role !== undefined) {
      values.tokenVersion = () =>
        `"tokenVersion" + CASE WHEN "role" = :role THEN 0 ELSE 1 END`;
    }

    return this.writeAudited(id, AuditActionEnum.UPDATED, actor, (manager) =>
      manager
        .createQueryBuilder()
        .update(UserEntity)
        .set(values)
        .where('id = :id', { id })
        .setParameter('role', dto.role)
        .execute(),
    );
  }

  async recordLogin(user: UserEntity): Promise<void> {
    await this.auditRecorder.record(this.dataSource.manager, {
      action: AuditActionEnum.LOGGED_IN,
      entity: { type: AuditEntityTypeEnum.USER, id: user.id },
      actor: buildUserAuditActor(user),
      changes: null,
      metadata: null,
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOneBy({ email });
  }

  async findByEmailOrFail(email: string): Promise<UserEntity> {
    const user = await this.findByEmail(email);
    if (!user)
      throw new NotFoundException(`User with email ${email} not found`);
    return user;
  }

  async findById(id: number): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByIdOrFail(id: number): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async findByIdWithPassword(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        tokenVersion: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async remove(id: number, actor: AuditActor): Promise<UserEntity> {
    return this.dataSource.transaction(async (manager) => {
      const user = await UsersService.lockOrFail(manager, id);

      await manager.delete(UserEntity, { id });

      await this.auditRecorder.record(manager, {
        action: AuditActionEnum.DELETED,
        entity: { type: AuditEntityTypeEnum.USER, id },
        actor,
        changes: buildAuditChanges(user, null, USER_AUDITED_FIELDS),
        metadata: null,
      });

      await this.publishChanged(manager, user, UserChangeEnum.DELETED);

      return user;
    });
  }

  async setActive(
    id: number,
    isActive: boolean,
    actor: AuditActor,
  ): Promise<void> {
    // Deactivating bumps tokenVersion too, so a later reactivation cannot
    // revive refresh tokens issued before it.
    await this.writeAudited(
      id,
      AuditActionEnum.STATUS_CHANGED,
      actor,
      (manager) =>
        manager.update(
          UserEntity,
          { id },
          isActive
            ? { isActive }
            : { isActive, tokenVersion: () => '"tokenVersion" + 1' },
        ),
    );
  }

  async logout(id: number, actor: AuditActor): Promise<void> {
    await this.writeAudited(id, AuditActionEnum.LOGGED_OUT, actor, (manager) =>
      manager.increment(UserEntity, { id }, 'tokenVersion', 1),
    );
  }

  // Anyone can ask for a reset by email, so nobody is signed in as the actor.
  async setPasswordResetToken(
    id: number,
    options: PasswordResetTokenOptions,
  ): Promise<void> {
    const { tokenHash, expiresAt } = options;

    await this.writeAudited(
      id,
      AuditActionEnum.PASSWORD_RESET_REQUESTED,
      ANONYMOUS_AUDIT_ACTOR,
      (manager) =>
        manager.update(
          UserEntity,
          { id },
          {
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: expiresAt,
          },
        ),
      { expiresAt: dayjs(expiresAt).toISOString() },
    );
  }

  async findByValidResetToken(tokenHash: string): Promise<UserEntity | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordResetTokenHash')
      .addSelect('user.passwordResetExpiresAt')
      .where('user.passwordResetTokenHash = :tokenHash', { tokenHash })
      .andWhere('user.passwordResetExpiresAt > CURRENT_TIMESTAMP')
      .getOne();
  }

  async clearPasswordResetToken(id: number): Promise<void> {
    const result = await this.userRepository.update(
      { id },
      { passwordResetTokenHash: null, passwordResetExpiresAt: null },
    );

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async resetPassword(
    id: number,
    hashedPassword: string,
    actor: AuditActor,
  ): Promise<void> {
    await this.writeAudited(
      id,
      AuditActionEnum.PASSWORD_RESET_COMPLETED,
      actor,
      (manager) =>
        manager.update(
          UserEntity,
          { id },
          {
            password: hashedPassword,
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
            tokenVersion: () => '"tokenVersion" + 1',
          },
        ),
    );
  }

  async changePassword(
    id: number,
    hashedPassword: string,
    actor: AuditActor,
  ): Promise<void> {
    await this.writeAudited(
      id,
      AuditActionEnum.PASSWORD_CHANGED,
      actor,
      (manager) =>
        manager.update(
          UserEntity,
          { id },
          {
            password: hashedPassword,
            tokenVersion: () => '"tokenVersion" + 1',
          },
        ),
    );
  }

  private async insert(
    dto: CreateUserDto,
    action: AuditActionEnum,
    actorFor: (user: UserEntity) => AuditActor,
  ): Promise<UserEntity> {
    return this.dataSource.transaction(async (manager) => {
      const existingUser = await manager.findOneBy(UserEntity, {
        email: dto.email,
      });

      if (existingUser) {
        throw new ConflictException('Email is already registered');
      }

      const user = await manager.save(manager.create(UserEntity, dto));

      await this.auditRecorder.record(manager, {
        action,
        entity: { type: AuditEntityTypeEnum.USER, id: user.id },
        actor: actorFor(user),
        changes: buildAuditChanges(null, user, USER_AUDITED_FIELDS),
        metadata: null,
      });

      await this.publishChanged(manager, user, UserChangeEnum.CREATED);

      return user;
    });
  }

  // Locks the row, applies the write, and records the before/after diff in the
  // same transaction, so the audit entry exists exactly when the change does.
  private async writeAudited(
    id: number,
    action: AuditActionEnum,
    actor: AuditActor,
    write: (manager: EntityManager) => Promise<unknown>,
    metadata: Record<string, unknown> | null = null,
  ): Promise<UserEntity> {
    return this.dataSource.transaction(async (manager) => {
      const before = await UsersService.lockOrFail(manager, id);

      await write(manager);

      const after = await manager.findOneByOrFail(UserEntity, { id });

      await this.auditRecorder.record(manager, {
        action,
        entity: { type: AuditEntityTypeEnum.USER, id },
        actor,
        changes: buildAuditChanges(before, after, USER_AUDITED_FIELDS),
        metadata,
      });

      if (buildAuditChanges(before, after, USER_SNAPSHOT_FIELDS)) {
        await this.publishChanged(manager, after, UserChangeEnum.UPDATED);
      }

      return after;
    });
  }

  private async publishChanged(
    manager: EntityManager,
    user: UserEntity,
    change: UserChangeEnum,
  ): Promise<void> {
    await this.outboxService.enqueue(
      manager,
      AuthKafkaTopic.USER_CHANGED,
      buildUserChangedEvent(user, change),
      String(user.id),
    );
  }

  private static async lockOrFail(
    manager: EntityManager,
    id: number,
  ): Promise<UserEntity> {
    const user = await manager.findOne(UserEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  private prepareListWhere(
    query: ListUsersQueryDto,
  ): FindOptionsWhere<UserEntity>[] {
    const { search, role, isActive } = query;

    const baseWhere: FindOptionsWhere<UserEntity> = {};

    if (role !== undefined) {
      baseWhere.role = role;
    }

    if (isActive !== undefined) {
      baseWhere.isActive = isActive;
    }

    if (!search) {
      return [baseWhere];
    }

    const searchPattern = `%${search.trim()}%`;

    return [
      {
        ...baseWhere,
        firstName: ILike(searchPattern),
      },
      {
        ...baseWhere,
        lastName: ILike(searchPattern),
      },
      {
        ...baseWhere,
        email: ILike(searchPattern),
      },
    ];
  }
}

export default UsersService;

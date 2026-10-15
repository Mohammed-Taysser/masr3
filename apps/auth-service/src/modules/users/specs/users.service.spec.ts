import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';

import { UserRoleEnum } from '@masr3/libs/auth';
import { dayjs } from '@masr3/libs/date';
import {
  ANONYMOUS_AUDIT_ACTOR,
  AuditActionEnum,
  AuditActor,
  AuditActorTypeEnum,
  AuditEntityTypeEnum,
  AuthKafkaTopic,
  buildAuditChanges,
  UserChangeEnum,
} from '@masr3/libs/kafka';
import { OutboxService } from '@masr3/libs/outbox';

import CreateUserDto from '../dto/create-user.dto';
import ListUsersQueryDto from '../dto/list-users-query.dto';
import UpdateUserDto from '../dto/update-user.dto';
import UserEntity from '../entities/user.entity';
import AuditRecorderService from '../../audit/audit-recorder.service';
import { OutboxEventMap } from '../../../kafka/kafka.interface';
import { USER_AUDITED_FIELDS } from '../users.constant';
import UsersService from '../users.service';

interface CallOrdered {
  mock: { invocationCallOrder: number[] };
}

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<UserEntity>>;
  let manager: jest.Mocked<EntityManager>;
  let dataSource: jest.Mocked<DataSource>;
  let auditRecorder: jest.Mocked<AuditRecorderService>;
  let outboxService: jest.Mocked<OutboxService<OutboxEventMap>>;

  const user = {
    id: 1,
    email: 'john@example.com',
    password: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRoleEnum.CUSTOMER,
    tokenVersion: 0,
    isActive: true,
  } as UserEntity;

  const adminActor: AuditActor = {
    type: AuditActorTypeEnum.USER,
    id: 99,
    role: UserRoleEnum.ADMIN,
  };

  const userActor: AuditActor = {
    type: AuditActorTypeEnum.USER,
    id: user.id,
    role: user.role,
  };

  const createDto: CreateUserDto = {
    email: 'john@example.com',
    password: 'Password123!',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRoleEnum.CUSTOMER,
  };

  const updateDto: UpdateUserDto = {
    firstName: 'Updated',
  };

  const createQuery = (
    overrides: Partial<ListUsersQueryDto> = {},
  ): ListUsersQueryDto => ({
    page: 1,
    limit: 10,
    sortBy: 'createdAt' as ListUsersQueryDto['sortBy'],
    sortOrder: 'DESC' as ListUsersQueryDto['sortOrder'],
    ...overrides,
  });

  const mockUpdateQuery = () => {
    const query = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    manager.createQueryBuilder.mockReturnValue(query as never);

    return query;
  };

  // The row as it was when locked, then as re-read after the write.
  const mockLockedRow = (before: UserEntity, after: UserEntity) => {
    manager.findOne.mockResolvedValue(before);
    manager.findOneByOrFail.mockResolvedValue(after);
  };

  const expectRowLocked = (id: number) => {
    expect(manager.findOne).toHaveBeenCalledWith(UserEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  };

  const expectCalledInOrder = (...mocks: CallOrdered[]) => {
    const order = mocks.map((mock) => mock.mock.invocationCallOrder[0]);

    expect(order).toEqual([...order].sort((first, second) => first - second));
  };

  const expectNothingWritten = () => {
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.increment).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(auditRecorder.record).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    repository = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserEntity>>;

    manager = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      increment: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      transaction: jest.fn((work: (m: EntityManager) => unknown) =>
        work(manager),
      ),
      manager,
    } as unknown as jest.Mocked<DataSource>;

    auditRecorder = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditRecorderService>;

    outboxService = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OutboxService<OutboxEventMap>>;

    service = new UsersService(
      repository,
      dataSource,
      auditRecorder,
      outboxService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated users', async () => {
      const users = [user];

      repository.findAndCount.mockResolvedValue([users, 25]);

      const result = await service.findAll(
        createQuery({
          page: 2,
        }),
      );

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: [{}],
        order: {
          createdAt: 'DESC',
          id: 'DESC',
        },
        skip: 10,
        take: 10,
      });

      expect(result).toEqual({
        items: users,
        meta: {
          page: 2,
          limit: 10,
          total: 25,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      });
    });

    it('filters by role', async () => {
      repository.findAndCount.mockResolvedValue([[user], 1]);

      await service.findAll(
        createQuery({
          role: UserRoleEnum.CUSTOMER,
        }),
      );

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            {
              role: UserRoleEnum.CUSTOMER,
            },
          ],
        }),
      );
    });

    it('filters by active status', async () => {
      repository.findAndCount.mockResolvedValue([[user], 1]);

      await service.findAll(
        createQuery({
          isActive: true,
        }),
      );

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            {
              isActive: true,
            },
          ],
        }),
      );
    });

    it('combines role and active status filters', async () => {
      repository.findAndCount.mockResolvedValue([[user], 1]);

      await service.findAll(
        createQuery({
          role: UserRoleEnum.DRIVER,
          isActive: false,
        }),
      );

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            {
              role: UserRoleEnum.DRIVER,
              isActive: false,
            },
          ],
        }),
      );
    });

    it('searches by first name, last name, or email', async () => {
      repository.findAndCount.mockResolvedValue([[user], 1]);

      await service.findAll(
        createQuery({
          search: 'john',
        }),
      );

      const [options] = repository.findAndCount.mock.calls[0];

      const where = options.where as FindOptionsWhere<UserEntity>[];

      expect(where).toHaveLength(3);

      expect(where).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            firstName: expect.anything(),
          }),
          expect.objectContaining({
            lastName: expect.anything(),
          }),
          expect.objectContaining({
            email: expect.anything(),
          }),
        ]),
      );
    });

    it('trims the search value', async () => {
      repository.findAndCount.mockResolvedValue([[user], 1]);

      await service.findAll(
        createQuery({
          search: '  john  ',
        }),
      );

      const [options] = repository.findAndCount.mock.calls[0];

      const where = options.where as FindOptionsWhere<UserEntity>[];

      const firstNameCondition = where.find(
        (condition) => 'firstName' in condition,
      );

      expect(firstNameCondition).toBeDefined();

      expect(firstNameCondition?.firstName).toEqual(
        expect.objectContaining({
          _value: '%john%',
        }),
      );
    });

    it('combines search with role and active status', async () => {
      repository.findAndCount.mockResolvedValue([[user], 1]);

      await service.findAll(
        createQuery({
          search: 'john',
          role: UserRoleEnum.CUSTOMER,
          isActive: true,
        }),
      );

      const [options] = repository.findAndCount.mock.calls[0];

      const where = options.where as FindOptionsWhere<UserEntity>[];

      expect(where).toHaveLength(3);

      expect(where).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: UserRoleEnum.CUSTOMER,
            isActive: true,
            firstName: expect.anything(),
          }),
          expect.objectContaining({
            role: UserRoleEnum.CUSTOMER,
            isActive: true,
            lastName: expect.anything(),
          }),
          expect.objectContaining({
            role: UserRoleEnum.CUSTOMER,
            isActive: true,
            email: expect.anything(),
          }),
        ]),
      );
    });

    it('uses the requested sorting and pagination', async () => {
      repository.findAndCount.mockResolvedValue([[user], 50]);

      await service.findAll(
        createQuery({
          page: 3,
          limit: 20,
          sortBy: 'email' as ListUsersQueryDto['sortBy'],
          sortOrder: 'ASC' as ListUsersQueryDto['sortOrder'],
        }),
      );

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: {
            email: 'ASC',
            id: 'ASC',
          },
          skip: 40,
          take: 20,
        }),
      );
    });

    it('calculates pagination for the first page', async () => {
      repository.findAndCount.mockResolvedValue([[user], 21]);

      const result = await service.findAll(
        createQuery({
          page: 1,
          limit: 10,
        }),
      );

      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 21,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it('calculates pagination for the last page', async () => {
      repository.findAndCount.mockResolvedValue([[user], 21]);

      const result = await service.findAll(
        createQuery({
          page: 3,
          limit: 10,
        }),
      );

      expect(result.meta).toEqual({
        page: 3,
        limit: 10,
        total: 21,
        totalPages: 3,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it('handles an empty result', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll(createQuery());

      expect(result).toEqual({
        items: [],
        meta: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });
  });

  describe('create', () => {
    it('inserts the user in a transaction and records USER_CREATED by the admin', async () => {
      const created = { ...createDto } as UserEntity;

      manager.findOneBy.mockResolvedValue(null);
      manager.create.mockReturnValue(created as never);
      manager.save.mockResolvedValue(user);

      const result = await service.create(createDto, adminActor);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.findOneBy).toHaveBeenCalledWith(UserEntity, {
        email: createDto.email,
      });
      expect(manager.create).toHaveBeenCalledWith(UserEntity, createDto);
      expect(manager.save).toHaveBeenCalledWith(created);
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.CREATED,
        entity: { type: AuditEntityTypeEnum.USER, id: user.id },
        actor: adminActor,
        changes: buildAuditChanges(null, user, USER_AUDITED_FIELDS),
        metadata: null,
      });
      expect(result).toBe(user);
    });

    it('throws ConflictException when email already exists', async () => {
      manager.findOneBy.mockResolvedValue(user);

      await expect(service.create(createDto, adminActor)).rejects.toThrow(
        new ConflictException('Email is already registered'),
      );

      expect(manager.save).not.toHaveBeenCalled();
      expect(auditRecorder.record).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('records USER_REGISTERED with the new user as their own actor', async () => {
      manager.findOneBy.mockResolvedValue(null);
      manager.create.mockReturnValue(user as never);
      manager.save.mockResolvedValue(user);

      const result = await service.register(createDto);

      expect(manager.save).toHaveBeenCalledWith(user);
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.REGISTERED,
        entity: { type: AuditEntityTypeEnum.USER, id: user.id },
        actor: userActor,
        changes: buildAuditChanges(null, user, USER_AUDITED_FIELDS),
        metadata: null,
      });
      expect(result).toBe(user);
    });

    it('throws ConflictException when email already exists', async () => {
      manager.findOneBy.mockResolvedValue(user);

      await expect(service.register(createDto)).rejects.toThrow(
        new ConflictException('Email is already registered'),
      );

      expect(manager.save).not.toHaveBeenCalled();
      expect(auditRecorder.record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates the locked row and records USER_UPDATED with before and after', async () => {
      const updatedUser = { ...user, firstName: 'Updated' } as UserEntity;
      const query = mockUpdateQuery();

      mockLockedRow(user, updatedUser);

      const result = await service.update(1, updateDto, adminActor);

      expectRowLocked(1);
      expect(query.update).toHaveBeenCalledWith(UserEntity);
      expect(query.set).toHaveBeenCalledWith({ ...updateDto });
      expect(query.where).toHaveBeenCalledWith('id = :id', { id: 1 });
      expect(query.execute).toHaveBeenCalled();
      expect(manager.findOneByOrFail).toHaveBeenCalledWith(UserEntity, {
        id: 1,
      });
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.UPDATED,
        entity: { type: AuditEntityTypeEnum.USER, id: 1 },
        actor: adminActor,
        changes: buildAuditChanges(user, updatedUser, USER_AUDITED_FIELDS),
        metadata: null,
      });
      expectCalledInOrder(
        manager.findOne,
        query.execute,
        manager.findOneByOrFail,
        auditRecorder.record,
      );
      expect(result).toBe(updatedUser);
    });

    it('bumps tokenVersion in the same UPDATE when the role is set', async () => {
      const query = mockUpdateQuery();

      mockLockedRow(user, user);

      await service.update(1, { role: UserRoleEnum.ADMIN }, adminActor);

      const values = query.set.mock.calls[0][0];

      expect(values.role).toBe(UserRoleEnum.ADMIN);
      // The CASE only bumps when the stored role actually differs.
      expect(values.tokenVersion()).toBe(
        '"tokenVersion" + CASE WHEN "role" = :role THEN 0 ELSE 1 END',
      );
      expect(query.setParameter).toHaveBeenCalledWith(
        'role',
        UserRoleEnum.ADMIN,
      );
    });

    it('leaves tokenVersion alone for an email-only change', async () => {
      const query = mockUpdateQuery();

      mockLockedRow(user, user);

      await service.update(1, { email: 'new@example.com' }, adminActor);

      expect(query.set.mock.calls[0][0]).toEqual({ email: 'new@example.com' });
    });

    it('returns the user unchanged for an empty update, without a transaction or audit', async () => {
      repository.findOne.mockResolvedValue(user);

      await expect(service.update(1, {}, adminActor)).resolves.toBe(user);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(auditRecorder.record).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the locked row and records USER_DELETED with no after state', async () => {
      manager.findOne.mockResolvedValue(user);

      const result = await service.remove(1, adminActor);

      expectRowLocked(1);
      expect(manager.delete).toHaveBeenCalledWith(UserEntity, { id: 1 });
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.DELETED,
        entity: { type: AuditEntityTypeEnum.USER, id: 1 },
        actor: adminActor,
        changes: buildAuditChanges(user, null, USER_AUDITED_FIELDS),
        metadata: null,
      });
      expectCalledInOrder(
        manager.findOne,
        manager.delete,
        auditRecorder.record,
      );
      expect(result).toBe(user);
    });
  });

  describe('setActive', () => {
    it('bumps tokenVersion when deactivating and records USER_STATUS_CHANGED', async () => {
      const deactivated = {
        ...user,
        isActive: false,
        tokenVersion: 1,
      } as UserEntity;

      mockLockedRow(user, deactivated);

      await service.setActive(1, false, adminActor);

      expectRowLocked(1);

      const [entity, criteria, values] = manager.update.mock.calls[0] as [
        unknown,
        unknown,
        { isActive: boolean; tokenVersion: () => string },
      ];

      expect(entity).toBe(UserEntity);
      expect(criteria).toEqual({ id: 1 });
      expect(values.isActive).toBe(false);
      expect(values.tokenVersion()).toBe('"tokenVersion" + 1');
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.STATUS_CHANGED,
        entity: { type: AuditEntityTypeEnum.USER, id: 1 },
        actor: adminActor,
        changes: buildAuditChanges(user, deactivated, USER_AUDITED_FIELDS),
        metadata: null,
      });
    });

    it('only flips the flag when activating', async () => {
      mockLockedRow({ ...user, isActive: false } as UserEntity, user);

      await service.setActive(1, true, adminActor);

      expect(manager.update).toHaveBeenCalledWith(
        UserEntity,
        { id: 1 },
        { isActive: true },
      );
    });
  });

  describe('logout', () => {
    it('increments tokenVersion and records USER_LOGGED_OUT by the user', async () => {
      const loggedOut = { ...user, tokenVersion: 1 } as UserEntity;

      mockLockedRow(user, loggedOut);

      await service.logout(1, userActor);

      expectRowLocked(1);
      expect(manager.increment).toHaveBeenCalledWith(
        UserEntity,
        { id: 1 },
        'tokenVersion',
        1,
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.LOGGED_OUT,
        entity: { type: AuditEntityTypeEnum.USER, id: 1 },
        actor: userActor,
        changes: buildAuditChanges(user, loggedOut, USER_AUDITED_FIELDS),
        metadata: null,
      });
    });
  });

  describe('setPasswordResetToken', () => {
    it('stores the token anonymously and records only its expiry as metadata', async () => {
      const expiresAt = dayjs('2026-09-30T12:00:00.000Z').toDate();

      mockLockedRow(user, user);

      await service.setPasswordResetToken(1, {
        tokenHash: 'hashed-token',
        expiresAt,
      });

      expectRowLocked(1);
      expect(manager.update).toHaveBeenCalledWith(
        UserEntity,
        { id: 1 },
        {
          passwordResetTokenHash: 'hashed-token',
          passwordResetExpiresAt: expiresAt,
        },
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.PASSWORD_RESET_REQUESTED,
        entity: { type: AuditEntityTypeEnum.USER, id: 1 },
        actor: ANONYMOUS_AUDIT_ACTOR,
        changes: buildAuditChanges(user, user, USER_AUDITED_FIELDS),
        metadata: { expiresAt: '2026-09-30T12:00:00.000Z' },
      });
    });
  });

  describe('resetPassword', () => {
    it('updates the password, clears the reset token, bumps tokenVersion and records it', async () => {
      const after = { ...user, tokenVersion: 1 } as UserEntity;

      mockLockedRow(user, after);

      await service.resetPassword(1, 'new-hashed-password', userActor);

      expectRowLocked(1);

      const [entity, criteria, payload] = manager.update.mock.calls[0] as [
        unknown,
        unknown,
        Record<string, unknown>,
      ];

      expect(entity).toBe(UserEntity);
      expect(criteria).toEqual({ id: 1 });
      expect(payload).toEqual({
        password: 'new-hashed-password',
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        tokenVersion: expect.any(Function),
      });
      expect((payload.tokenVersion as () => string)()).toBe(
        '"tokenVersion" + 1',
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.PASSWORD_RESET_COMPLETED,
        entity: { type: AuditEntityTypeEnum.USER, id: 1 },
        actor: userActor,
        changes: buildAuditChanges(user, after, USER_AUDITED_FIELDS),
        metadata: null,
      });
    });
  });

  describe('audit diff never carries secrets', () => {
    it('records only the tokenVersion bump of a password reset', async () => {
      const after = {
        ...user,
        password: 'new-hashed-password',
        passwordResetTokenHash: 'other-hash',
        passwordResetExpiresAt: dayjs('2026-09-30T12:00:00.000Z').toDate(),
        tokenVersion: 1,
      } as UserEntity;

      mockLockedRow(
        { ...user, passwordResetTokenHash: 'hash' } as UserEntity,
        after,
      );

      await service.resetPassword(1, 'new-hashed-password', userActor);

      const [, record] = auditRecorder.record.mock.calls[0];

      expect(record.changes).toEqual({ tokenVersion: { old: 0, new: 1 } });
    });

    it.each(['password', 'passwordResetTokenHash', 'passwordResetExpiresAt'])(
      'leaves %s out of a creation diff',
      async (field) => {
        manager.findOneBy.mockResolvedValue(null);
        manager.create.mockReturnValue(user as never);
        manager.save.mockResolvedValue({
          ...user,
          passwordResetTokenHash: 'hash',
          passwordResetExpiresAt: dayjs('2026-09-30T12:00:00.000Z').toDate(),
        } as UserEntity);

        await service.register(createDto);

        const [, record] = auditRecorder.record.mock.calls[0];

        expect(record.changes).not.toHaveProperty(field);
        expect(record.changes).toHaveProperty('email');
      },
    );
  });

  describe('changePassword', () => {
    it('updates the password, bumps tokenVersion and records PASSWORD_CHANGED', async () => {
      const after = { ...user, tokenVersion: 1 } as UserEntity;

      mockLockedRow(user, after);

      await service.changePassword(1, 'new-hashed-password', userActor);

      expectRowLocked(1);

      const [entity, criteria, payload] = manager.update.mock.calls[0] as [
        unknown,
        unknown,
        Record<string, unknown>,
      ];

      expect(entity).toBe(UserEntity);
      expect(criteria).toEqual({ id: 1 });
      expect(payload).toEqual({
        password: 'new-hashed-password',
        tokenVersion: expect.any(Function),
      });
      expect((payload.tokenVersion as () => string)()).toBe(
        '"tokenVersion" + 1',
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.PASSWORD_CHANGED,
        entity: { type: AuditEntityTypeEnum.USER, id: 1 },
        actor: userActor,
        changes: buildAuditChanges(user, after, USER_AUDITED_FIELDS),
        metadata: null,
      });
    });
  });

  describe('when the locked row is missing', () => {
    const resetTokenOptions = {
      tokenHash: 'hashed-token',
      expiresAt: dayjs('2026-09-30T12:00:00.000Z').toDate(),
    };

    it.each<[string, (service: UsersService) => Promise<unknown>]>([
      ['update', (users) => users.update(999, updateDto, adminActor)],
      ['remove', (users) => users.remove(999, adminActor)],
      ['setActive', (users) => users.setActive(999, false, adminActor)],
      ['logout', (users) => users.logout(999, userActor)],
      [
        'setPasswordResetToken',
        (users) => users.setPasswordResetToken(999, resetTokenOptions),
      ],
      [
        'resetPassword',
        (users) => users.resetPassword(999, 'new-hashed-password', userActor),
      ],
      [
        'changePassword',
        (users) => users.changePassword(999, 'new-hashed-password', userActor),
      ],
    ])(
      '%s throws NotFoundException and writes nothing',
      async (_method, call) => {
        manager.findOne.mockResolvedValue(null);

        await expect(call(service)).rejects.toThrow(
          new NotFoundException('User with ID 999 not found'),
        );

        expectRowLocked(999);
        expectNothingWritten();
      },
    );
  });

  describe('recordLogin', () => {
    it('records USER_LOGGED_IN on the default manager without a transaction', async () => {
      await service.recordLogin(user);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(auditRecorder.record).toHaveBeenCalledWith(dataSource.manager, {
        action: AuditActionEnum.LOGGED_IN,
        entity: { type: AuditEntityTypeEnum.USER, id: user.id },
        actor: userActor,
        changes: buildAuditChanges(null, null, USER_AUDITED_FIELDS),
        metadata: null,
      });
    });
  });

  describe('findByEmail', () => {
    it('returns the user when found', async () => {
      repository.findOneBy.mockResolvedValue(user);

      const result = await service.findByEmail(user.email);

      expect(repository.findOneBy).toHaveBeenCalledWith({
        email: user.email,
      });

      expect(result).toBe(user);
    });

    it('returns null when user does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await service.findByEmail('missing@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByEmailOrFail', () => {
    it('returns the user when found', async () => {
      repository.findOneBy.mockResolvedValue(user);

      const result = await service.findByEmailOrFail(user.email);

      expect(result).toBe(user);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.findByEmailOrFail('missing@example.com'),
      ).rejects.toThrow(
        new NotFoundException('User with email missing@example.com not found'),
      );
    });
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      repository.findOne.mockResolvedValue(user);

      const result = await service.findById(1);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });

      expect(result).toBe(user);
    });

    it('returns null when user does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('returns the user when found', async () => {
      repository.findOne.mockResolvedValue(user);

      const result = await service.findByIdOrFail(1);

      expect(result).toBe(user);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(999)).rejects.toThrow(
        new NotFoundException('User with ID 999 not found'),
      );
    });
  });

  describe('findByIdWithPassword', () => {
    it('returns the user with password and active status selected', async () => {
      repository.findOne.mockResolvedValue(user);

      const result = await service.findByIdWithPassword(1);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          email: true,
          password: true,
          role: true,
          tokenVersion: true,
          isActive: true,
        },
      });

      expect(result).toBe(user);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findByIdWithPassword(999)).rejects.toThrow(
        new NotFoundException('User with ID 999 not found'),
      );
    });
  });

  describe('findByValidResetToken', () => {
    const createQueryBuilderMock = (result: UserEntity | null) => {
      const queryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(result),
      };

      repository.createQueryBuilder.mockReturnValue(queryBuilder as never);

      return queryBuilder;
    };

    it('returns the user for a valid reset token', async () => {
      const queryBuilder = createQueryBuilderMock(user);

      const result = await service.findByValidResetToken('hashed-token');

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');

      expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(
        1,
        'user.passwordResetTokenHash',
      );

      expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(
        2,
        'user.passwordResetExpiresAt',
      );

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.passwordResetTokenHash = :tokenHash',
        {
          tokenHash: 'hashed-token',
        },
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.passwordResetExpiresAt > CURRENT_TIMESTAMP',
      );

      expect(queryBuilder.getOne).toHaveBeenCalled();

      expect(result).toBe(user);
    });

    it('returns null when no valid token exists', async () => {
      const queryBuilder = createQueryBuilderMock(null);

      const result = await service.findByValidResetToken('invalid-token');

      expect(queryBuilder.getOne).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('clearPasswordResetToken', () => {
    it('clears the reset token hash and expiry', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as never);

      await service.clearPasswordResetToken(1);

      expect(repository.update).toHaveBeenCalledWith(
        { id: 1 },
        { passwordResetTokenHash: null, passwordResetExpiresAt: null },
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.update.mockResolvedValue({ affected: 0 } as never);

      await expect(service.clearPasswordResetToken(999)).rejects.toThrow(
        new NotFoundException('User with ID 999 not found'),
      );
    });
  });

  describe('auth.user-changed', () => {
    const expectPublished = (snapshot: UserEntity, change: UserChangeEnum) => {
      expect(outboxService.enqueue).toHaveBeenCalledWith(
        manager,
        AuthKafkaTopic.USER_CHANGED,
        {
          userId: snapshot.id,
          firstName: snapshot.firstName,
          lastName: snapshot.lastName,
          role: snapshot.role,
          isActive: snapshot.isActive,
          change,
        },
        String(snapshot.id),
      );
    };

    it('publishes CREATED when a user is created', async () => {
      manager.findOneBy.mockResolvedValue(null);
      manager.create.mockReturnValue(user as never);
      manager.save.mockResolvedValue(user);

      await service.create(createDto, adminActor);

      expectPublished(user, UserChangeEnum.CREATED);
    });

    it('publishes UPDATED with the new state when the name changes', async () => {
      const renamed = { ...user, lastName: 'Renamed' } as UserEntity;

      mockUpdateQuery();
      mockLockedRow(user, renamed);

      await service.update(1, { lastName: 'Renamed' }, adminActor);

      expectPublished(renamed, UserChangeEnum.UPDATED);
    });

    it('publishes UPDATED when the user is deactivated', async () => {
      const deactivated = { ...user, isActive: false } as UserEntity;

      mockLockedRow(user, deactivated);

      await service.setActive(1, false, adminActor);

      expectPublished(deactivated, UserChangeEnum.UPDATED);
    });

    it('publishes nothing when no snapshot field changed', async () => {
      mockLockedRow(user, { ...user, tokenVersion: 1 } as UserEntity);

      await service.logout(1, userActor);

      expect(outboxService.enqueue).not.toHaveBeenCalled();
    });

    it('publishes DELETED with the last state when a user is removed', async () => {
      manager.findOne.mockResolvedValue(user);

      await service.remove(1, adminActor);

      expectPublished(user, UserChangeEnum.DELETED);
    });
  });
});

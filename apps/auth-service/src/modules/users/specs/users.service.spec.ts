import { ConflictException, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, Repository } from 'typeorm';

import CreateUserDto from '../dto/create-user.dto';
import ListUsersQueryDto from '../dto/list-users-query.dto';
import UpdateUserDto from '../dto/update-user.dto';
import UserEntity from '../entities/user.entity';
import { UserRoleEnum } from '@masr3/libs';
import UsersService from '../users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<UserEntity>>;

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

  beforeEach(() => {
    repository = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      preload: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      increment: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserEntity>>;

    service = new UsersService(repository);
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
    it('creates a user when email is not registered', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(user);
      repository.save.mockResolvedValue(user);

      const result = await service.create(createDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          email: createDto.email,
        },
      });

      expect(repository.create).toHaveBeenCalledWith(createDto);
      expect(repository.save).toHaveBeenCalledWith(user);
      expect(result).toBe(user);
    });

    it('throws ConflictException when email already exists', async () => {
      repository.findOne.mockResolvedValue(user);

      await expect(service.create(createDto)).rejects.toThrow(
        new ConflictException('Email is already registered'),
      );

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const mockUpdateQuery = (affected: number) => {
      const query = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected }),
      };

      repository.createQueryBuilder.mockReturnValue(query as never);

      return query;
    };

    it('updates an existing user and returns it', async () => {
      const updatedUser = { ...user, firstName: 'Updated' };
      const query = mockUpdateQuery(1);

      repository.findOne.mockResolvedValue(updatedUser);

      const result = await service.update(1, updateDto);

      expect(query.set).toHaveBeenCalledWith({ ...updateDto });
      expect(query.where).toHaveBeenCalledWith('id = :id', { id: 1 });
      expect(result).toBe(updatedUser);
    });

    it('bumps tokenVersion in the same UPDATE when the role is set', async () => {
      const query = mockUpdateQuery(1);

      repository.findOne.mockResolvedValue(user);

      await service.update(1, { role: UserRoleEnum.ADMIN });

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
      const query = mockUpdateQuery(1);

      repository.findOne.mockResolvedValue(user);

      await service.update(1, { email: 'new@example.com' });

      expect(query.set.mock.calls[0][0]).toEqual({ email: 'new@example.com' });
    });

    it('returns the user unchanged for an empty update', async () => {
      repository.findOne.mockResolvedValue(user);

      await expect(service.update(1, {})).resolves.toBe(user);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockUpdateQuery(0);

      await expect(service.update(999, updateDto)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
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

  describe('remove', () => {
    it('removes and returns the user', async () => {
      repository.findOne.mockResolvedValue(user);
      repository.remove.mockResolvedValue(user);

      const result = await service.remove(1);

      expect(repository.remove).toHaveBeenCalledWith(user);
      expect(result).toBe(user);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(
        new NotFoundException('User with ID 999 not found'),
      );

      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  describe('setActive', () => {
    it('bumps tokenVersion when deactivating', async () => {
      repository.update.mockResolvedValue({
        affected: 1,
      } as never);

      await service.setActive(1, false);

      const [criteria, values] = repository.update.mock.calls[0] as [
        unknown,
        { isActive: boolean; tokenVersion: () => string },
      ];

      expect(criteria).toEqual({ id: 1 });
      expect(values.isActive).toBe(false);
      expect(values.tokenVersion()).toBe('"tokenVersion" + 1');
    });

    it('only flips the flag when activating', async () => {
      repository.update.mockResolvedValue({
        affected: 1,
      } as never);

      await service.setActive(1, true);

      expect(repository.update).toHaveBeenCalledWith(
        { id: 1 },
        { isActive: true },
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.update.mockResolvedValue({
        affected: 0,
      } as never);

      await expect(service.setActive(999, false)).rejects.toThrow(
        new NotFoundException('User with ID 999 not found'),
      );
    });
  });

  describe('incrementTokenVersion', () => {
    it('increments token version', async () => {
      repository.increment.mockResolvedValue({
        affected: 1,
      } as never);

      await service.incrementTokenVersion(1);

      expect(repository.increment).toHaveBeenCalledWith(
        { id: 1 },
        'tokenVersion',
        1,
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.increment.mockResolvedValue({
        affected: 0,
      } as never);

      await expect(service.incrementTokenVersion(999)).rejects.toThrow(
        new NotFoundException('User with ID 999 not found'),
      );
    });
  });

  describe('setPasswordResetToken', () => {
    it('sets the reset token and expiration', async () => {
      const expiresAt = new Date('2026-09-30T12:00:00.000Z');

      repository.update.mockResolvedValue({
        affected: 1,
      } as never);

      await service.setPasswordResetToken(1, {
        tokenHash: 'hashed-token',
        expiresAt,
      });

      expect(repository.update).toHaveBeenCalledWith(
        { id: 1 },
        {
          passwordResetTokenHash: 'hashed-token',
          passwordResetExpiresAt: expiresAt,
        },
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.update.mockResolvedValue({
        affected: 0,
      } as never);

      await expect(
        service.setPasswordResetToken(999, {
          tokenHash: 'hashed-token',
          expiresAt: new Date(),
        }),
      ).rejects.toThrow(new NotFoundException('User with ID 999 not found'));
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

  describe('resetPassword', () => {
    it('updates the password, clears the reset token, and increments token version', async () => {
      repository.update.mockResolvedValue({
        affected: 1,
      } as never);

      await service.resetPassword(1, 'new-hashed-password');

      const [criteria, payload] = repository.update.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];

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
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.update.mockResolvedValue({
        affected: 0,
      } as never);

      await expect(
        service.resetPassword(999, 'new-hashed-password'),
      ).rejects.toThrow(new NotFoundException('User with ID 999 not found'));
    });
  });

  describe('changePassword', () => {
    it('updates the password and increments token version', async () => {
      repository.update.mockResolvedValue({
        affected: 1,
      } as never);

      await service.changePassword(1, 'new-hashed-password');

      const [criteria, payload] = repository.update.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];

      expect(criteria).toEqual({ id: 1 });

      expect(payload).toEqual({
        password: 'new-hashed-password',
        tokenVersion: expect.any(Function),
      });

      expect((payload.tokenVersion as () => string)()).toBe(
        '"tokenVersion" + 1',
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.update.mockResolvedValue({
        affected: 0,
      } as never);

      await expect(
        service.changePassword(999, 'new-hashed-password'),
      ).rejects.toThrow(new NotFoundException('User with ID 999 not found'));
    });
  });
});

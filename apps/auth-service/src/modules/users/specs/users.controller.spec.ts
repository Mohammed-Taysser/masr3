import 'reflect-metadata';

import { ROLES_KEY, UserRoleEnum } from '@masr3/libs';

import CreateUserDto from '../dto/create-user.dto';
import ListUsersQueryDto from '../dto/list-users-query.dto';
import UpdateUserStatusDto from '../dto/update-user-status.dto';
import UpdateUserDto from '../dto/update-user.dto';

import UserEntity from '../entities/user.entity';
import UsersController from '../users.controller';
import UsersService from '../users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

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

  const updateStatusDto: UpdateUserStatusDto = {
    isActive: false,
  };

  const listQuery = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  } as ListUsersQueryDto;

  beforeEach(() => {
    usersService = {
      findAll: jest.fn(),
      findByIdOrFail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    controller = new UsersController(usersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns the paginated users from the service', async () => {
      const result = {
        items: [user],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      usersService.findAll.mockResolvedValue(result);

      const response = await controller.findAll(listQuery);

      expect(usersService.findAll).toHaveBeenCalledWith(listQuery);
      expect(usersService.findAll).toHaveBeenCalledTimes(1);
      expect(response).toBe(result);
    });

    it('passes the query object without modifying it', async () => {
      usersService.findAll.mockResolvedValue({
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

      await controller.findAll(listQuery);

      const [query] = usersService.findAll.mock.calls[0];

      expect(query).toBe(listQuery);
    });
  });

  describe('findById', () => {
    it('returns the user from the service', async () => {
      usersService.findByIdOrFail.mockResolvedValue(user);

      const response = await controller.findById(1);

      expect(usersService.findByIdOrFail).toHaveBeenCalledWith(1);
      expect(usersService.findByIdOrFail).toHaveBeenCalledTimes(1);
      expect(response).toBe(user);
    });

    it('passes the id directly to the service', async () => {
      usersService.findByIdOrFail.mockResolvedValue(user);

      await controller.findById(25);

      expect(usersService.findByIdOrFail).toHaveBeenCalledWith(25);
    });
  });

  describe('create', () => {
    it('creates and returns the user', async () => {
      usersService.create.mockResolvedValue(user);

      const response = await controller.create(createDto);

      expect(usersService.create).toHaveBeenCalledWith(createDto);
      expect(usersService.create).toHaveBeenCalledTimes(1);
      expect(response).toBe(user);
    });

    it('passes the dto without modifying it', async () => {
      usersService.create.mockResolvedValue(user);

      await controller.create(createDto);

      const [dto] = usersService.create.mock.calls[0];

      expect(dto).toBe(createDto);
    });
  });

  describe('update', () => {
    it('updates and returns the user', async () => {
      const updatedUser = {
        ...user,
        firstName: 'Updated',
      } as UserEntity;

      usersService.update.mockResolvedValue(updatedUser);

      const response = await controller.update(1, updateDto);

      expect(usersService.update).toHaveBeenCalledWith(1, updateDto);
      expect(usersService.update).toHaveBeenCalledTimes(1);
      expect(response).toBe(updatedUser);
    });

    it('passes both id and dto to the service', async () => {
      usersService.update.mockResolvedValue(user);

      await controller.update(42, updateDto);

      expect(usersService.update).toHaveBeenCalledWith(42, updateDto);
    });
  });

  describe('updateStatus', () => {
    it('sets the user active status', async () => {
      usersService.setActive.mockResolvedValue(undefined);

      const response = await controller.updateStatus(1, updateStatusDto);

      expect(usersService.setActive).toHaveBeenCalledWith(
        1,
        updateStatusDto.isActive,
      );

      expect(usersService.setActive).toHaveBeenCalledTimes(1);
      expect(response).toBeUndefined();
    });

    it('passes true when activating a user', async () => {
      usersService.setActive.mockResolvedValue(undefined);

      const dto: UpdateUserStatusDto = {
        isActive: true,
      };

      await controller.updateStatus(5, dto);

      expect(usersService.setActive).toHaveBeenCalledWith(5, true);
    });

    it('does not return the service result', async () => {
      usersService.setActive.mockResolvedValue(undefined);

      const result = await controller.updateStatus(1, updateStatusDto);

      expect(result).toBeUndefined();
    });
  });

  describe('guards', () => {
    it('defaults the whole controller to admins', () => {
      expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual([
        UserRoleEnum.ADMIN,
      ]);
    });

    it('opens findAll to every role', () => {
      const roles: UserRoleEnum[] = Reflect.getMetadata(
        ROLES_KEY,
        UsersController.prototype.findAll,
      );

      // order is irrelevant, coverage is not
      expect([...roles].sort()).toEqual(Object.values(UserRoleEnum).sort());
    });

    it.each([
      'findById',
      'create',
      'update',
      'updateStatus',
      'remove',
    ] as const)('leaves %s on the admin-only default', (method) => {
      expect(
        Reflect.getMetadata(ROLES_KEY, UsersController.prototype[method]),
      ).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('removes and returns the user', async () => {
      usersService.remove.mockResolvedValue(user);

      const response = await controller.remove(1);

      expect(usersService.remove).toHaveBeenCalledWith(1);
      expect(usersService.remove).toHaveBeenCalledTimes(1);
      expect(response).toBe(user);
    });

    it('passes the id directly to the service', async () => {
      usersService.remove.mockResolvedValue(user);

      await controller.remove(99);

      expect(usersService.remove).toHaveBeenCalledWith(99);
    });
  });
});

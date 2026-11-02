import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { UserRoleEnum } from '@masr3/libs/auth';
import { UserChangedEvent, UserChangeEnum } from '@masr3/libs/kafka';

import UserEntity from '../entities/user.entity';
import UserService from '../user.service';

describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<Repository<UserEntity>>;

  const event: UserChangedEvent = {
    eventId: 'event-1',
    occurredAt: '2026-10-15T08:00:00.000Z',
    userId: 3,
    firstName: 'Mona',
    lastName: 'Adel',
    role: UserRoleEnum.CUSTOMER,
    isActive: true,
    change: UserChangeEnum.UPDATED,
  };

  beforeEach(() => {
    repository = {
      upsert: jest.fn(),
      delete: jest.fn(),
      findOneBy: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserEntity>>;

    service = new UserService(repository);
  });

  describe('findActiveOrFail', () => {
    it('looks the user up by id and role and returns them when active', async () => {
      const user = {
        userId: 3,
        role: UserRoleEnum.CUSTOMER,
        isActive: true,
      } as UserEntity;

      repository.findOneBy.mockResolvedValue(user);

      await expect(
        service.findActiveOrFail(3, UserRoleEnum.CUSTOMER),
      ).resolves.toBe(user);
      expect(repository.findOneBy).toHaveBeenCalledWith({
        userId: 3,
        role: UserRoleEnum.CUSTOMER,
      });
    });

    it('throws NotFoundException for an unknown user or another role', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.findActiveOrFail(3, UserRoleEnum.DRIVER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException for a deactivated user', async () => {
      repository.findOneBy.mockResolvedValue({
        userId: 3,
        role: UserRoleEnum.CUSTOMER,
        isActive: false,
      } as UserEntity);

      await expect(
        service.findActiveOrFail(3, UserRoleEnum.CUSTOMER),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('applyUserChanged', () => {
    it.each([
      [UserChangeEnum.CREATED, UserRoleEnum.CUSTOMER],
      [UserChangeEnum.UPDATED, UserRoleEnum.DRIVER],
    ])(
      'upserts the user on %s as %s, keyed by userId',
      async (change, role) => {
        await service.applyUserChanged({ ...event, change, role });

        expect(repository.upsert).toHaveBeenCalledWith(
          { userId: 3, role, isActive: true },
          { conflictPaths: ['userId'] },
        );
        expect(repository.delete).not.toHaveBeenCalled();
      },
    );

    it('keeps a deactivated user, marked inactive', async () => {
      await service.applyUserChanged({ ...event, isActive: false });

      expect(repository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
        { conflictPaths: ['userId'] },
      );
    });

    it('deletes the row when the user is deleted', async () => {
      await service.applyUserChanged({
        ...event,
        change: UserChangeEnum.DELETED,
      });

      expect(repository.delete).toHaveBeenCalledWith({ userId: 3 });
      expect(repository.upsert).not.toHaveBeenCalled();
    });

    it.each([UserRoleEnum.ADMIN, 'COURIER'])(
      'deletes the row when the role is %s',
      async (role) => {
        await service.applyUserChanged({
          ...event,
          role: role as UserRoleEnum,
        });

        expect(repository.delete).toHaveBeenCalledWith({ userId: 3 });
        expect(repository.upsert).not.toHaveBeenCalled();
      },
    );
  });
});

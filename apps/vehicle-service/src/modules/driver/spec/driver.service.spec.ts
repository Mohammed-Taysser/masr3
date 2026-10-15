import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { UserRoleEnum } from '@masr3/libs/auth';
import { UserChangedEvent, UserChangeEnum } from '@masr3/libs/kafka';

import DriverService from '../driver.service';
import DriverEntity from '../entities/driver.entity';

describe('DriverService', () => {
  let service: DriverService;
  let repository: jest.Mocked<Repository<DriverEntity>>;

  const event: UserChangedEvent = {
    eventId: 'event-1',
    occurredAt: '2026-10-15T08:00:00.000Z',
    userId: 5,
    firstName: 'Omar',
    lastName: 'Hassan',
    role: UserRoleEnum.DRIVER,
    isActive: true,
    change: UserChangeEnum.UPDATED,
  };

  beforeEach(() => {
    repository = {
      upsert: jest.fn(),
      delete: jest.fn(),
      findOneBy: jest.fn(),
    } as unknown as jest.Mocked<Repository<DriverEntity>>;

    service = new DriverService(repository);
  });

  describe('applyUserChanged', () => {
    it.each([UserChangeEnum.CREATED, UserChangeEnum.UPDATED])(
      'upserts a driver on %s, keyed by userId',
      async (change) => {
        await service.applyUserChanged({ ...event, change });

        expect(repository.upsert).toHaveBeenCalledWith(
          {
            userId: 5,
            firstName: 'Omar',
            lastName: 'Hassan',
            isActive: true,
          },
          { conflictPaths: ['userId'] },
        );
        expect(repository.delete).not.toHaveBeenCalled();
      },
    );

    it('keeps a deactivated driver, marked inactive', async () => {
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

      expect(repository.delete).toHaveBeenCalledWith({ userId: 5 });
      expect(repository.upsert).not.toHaveBeenCalled();
    });

    it.each([UserRoleEnum.CUSTOMER, UserRoleEnum.ADMIN, 'COURIER'])(
      'deletes the row when the role is %s',
      async (role) => {
        await service.applyUserChanged({
          ...event,
          role: role as UserRoleEnum,
        });

        expect(repository.delete).toHaveBeenCalledWith({ userId: 5 });
        expect(repository.upsert).not.toHaveBeenCalled();
      },
    );
  });

  describe('findActiveOrFail', () => {
    it('returns an active driver', async () => {
      const driver = { userId: 5, isActive: true } as DriverEntity;

      repository.findOneBy.mockResolvedValue(driver);

      await expect(service.findActiveOrFail(5)).resolves.toBe(driver);
    });

    it('throws NotFoundException for an unknown driver', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findActiveOrFail(5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException for a deactivated driver', async () => {
      repository.findOneBy.mockResolvedValue({
        userId: 5,
        isActive: false,
      } as DriverEntity);

      await expect(service.findActiveOrFail(5)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});

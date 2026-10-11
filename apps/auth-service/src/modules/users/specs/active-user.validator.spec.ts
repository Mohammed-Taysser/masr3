import { UserRoleEnum } from '@masr3/libs';

import ActiveUserValidator from '../active-user.validator';
import UserEntity from '../entities/user.entity';
import UsersService from '../users.service';

describe('ActiveUserValidator', () => {
  let usersService: jest.Mocked<UsersService>;
  let validator: ActiveUserValidator;

  const principal = {
    id: 1,
    email: 'john@example.com',
    role: UserRoleEnum.CUSTOMER,
    tokenVersion: 2,
  };

  beforeEach(() => {
    usersService = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;
    validator = new ActiveUserValidator(usersService);
  });

  it('accepts an active user with the same token version', async () => {
    usersService.findById.mockResolvedValue({
      isActive: true,
      tokenVersion: 2,
    } as UserEntity);

    await expect(validator.isCurrent(principal)).resolves.toBe(true);
    expect(usersService.findById).toHaveBeenCalledWith(1);
  });

  it.each([
    ['a missing user', null],
    ['an inactive user', { isActive: false, tokenVersion: 2 }],
    ['a newer token version', { isActive: true, tokenVersion: 3 }],
  ])('rejects %s', async (_case, storedUser) => {
    usersService.findById.mockResolvedValue(storedUser as UserEntity);

    await expect(validator.isCurrent(principal)).resolves.toBe(false);
  });

  it('lets a database error propagate', async () => {
    const outage = new Error('connection terminated');

    usersService.findById.mockRejectedValue(outage);

    await expect(validator.isCurrent(principal)).rejects.toBe(outage);
  });
});

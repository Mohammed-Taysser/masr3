import { instanceToPlain, plainToInstance } from 'class-transformer';

import PaginatedUsersResponseDto from '../../dto/paginated-users-response.dto';
import UserEntity from '../../entities/user.entity';
import { UserRoleEnum } from '../../users.enum';

describe('PaginatedUsersResponseDto', () => {
  const user = Object.assign(new UserEntity(), {
    id: 2,
    email: 'customer@masr3.local',
    role: UserRoleEnum.CUSTOMER,
    firstName: 'Demo',
    lastName: 'Customer',
    createdAt: new Date('2026-09-20T08:20:46.408Z'),
    updatedAt: new Date('2026-09-21T08:20:46.408Z'),
    password: 'hashed-password',
    tokenVersion: 3,
    isActive: true,
    passwordResetTokenHash: 'reset-hash',
    passwordResetExpiresAt: new Date('2026-09-21T08:30:46.408Z'),
  });

  const source = {
    items: [user],
    meta: {
      page: 1,
      limit: 20,
      total: 42,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    },
  };

  // Mirrors what ClassSerializerInterceptor does for @SerializeOptions({ type }).
  const serialize = () =>
    instanceToPlain(plainToInstance(PaginatedUsersResponseDto, source), {
      excludeExtraneousValues: true,
    });

  it('exposes items and meta', () => {
    expect(Object.keys(serialize()).sort()).toEqual(['items', 'meta']);
  });

  it('maps each item through UserResponseDto', () => {
    const result = serialize() as { items: Record<string, unknown>[] };

    expect(result.items).toEqual([
      {
        id: 2,
        email: 'customer@masr3.local',
        role: UserRoleEnum.CUSTOMER,
        firstName: 'Demo',
        lastName: 'Customer',
        createdAt: new Date('2026-09-20T08:20:46.408Z'),
      },
    ]);
  });

  it('drops password and reset-token fields from the items', () => {
    const result = serialize() as { items: Record<string, unknown>[] };

    expect(result.items[0]).not.toHaveProperty('password');
    expect(result.items[0]).not.toHaveProperty('passwordResetTokenHash');
    expect(result.items[0]).not.toHaveProperty('passwordResetExpiresAt');
    expect(result.items[0]).not.toHaveProperty('tokenVersion');
  });

  it('exposes the full pagination meta', () => {
    const result = serialize() as { meta: Record<string, unknown> };

    expect(result.meta).toEqual(source.meta);
  });
});

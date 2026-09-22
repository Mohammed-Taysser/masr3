import { instanceToPlain } from 'class-transformer';

import UserResponseDto from '../../dto/user-response.dto';
import { UserRoleEnum } from '../../users.enum';

describe('UserResponseDto', () => {
  it('exposes the expected user fields', () => {
    const dto = new UserResponseDto();

    Object.assign(dto, {
      id: 1,
      email: 'customer@masr3.local',
      role: UserRoleEnum.CUSTOMER,
      firstName: 'Demo',
      lastName: 'Customer',
      createdAt: new Date('2026-09-20T08:20:46.408Z'),
    });

    const result = instanceToPlain(dto);

    expect(result).toEqual({
      id: 1,
      email: 'customer@masr3.local',
      role: UserRoleEnum.CUSTOMER,
      firstName: 'Demo',
      lastName: 'Customer',
      createdAt: new Date('2026-09-20T08:20:46.408Z'),
    });
  });

  it('does not expose unexpected properties', () => {
    const dto = new UserResponseDto();

    Object.assign(dto, {
      id: 1,
      email: 'customer@masr3.local',
      role: UserRoleEnum.CUSTOMER,
      firstName: 'Demo',
      lastName: 'Customer',
      createdAt: new Date('2026-09-20T08:20:46.408Z'),

      password: 'secret',
      tokenVersion: 10,
      isActive: true,
    });

    const result = instanceToPlain(dto, { excludeExtraneousValues: true });

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('tokenVersion');
    expect(result).not.toHaveProperty('isActive');
  });
});

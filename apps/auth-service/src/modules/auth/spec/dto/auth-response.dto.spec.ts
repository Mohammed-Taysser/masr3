import { instanceToPlain } from 'class-transformer';

import AuthResponseDto from '../../dto/auth-response.dto';
import UserResponseDto from '../../../users/dto/user-response.dto';
import { UserRoleEnum } from '../../../users/users.enum';

describe('AuthResponseDto', () => {
  it('exposes the access token and the nested user', () => {
    const user = new UserResponseDto();

    Object.assign(user, {
      id: 1,
      email: 'customer@masr3.local',
      role: UserRoleEnum.CUSTOMER,
      firstName: 'Demo',
      lastName: 'Customer',
      createdAt: new Date('2026-09-20T08:20:46.408Z'),
    });

    const dto = new AuthResponseDto();

    Object.assign(dto, {
      accessToken: 'access-token',
      user,
    });

    const result = instanceToPlain(dto);

    expect(result).toEqual({
      accessToken: 'access-token',
      user: {
        id: 1,
        email: 'customer@masr3.local',
        role: UserRoleEnum.CUSTOMER,
        firstName: 'Demo',
        lastName: 'Customer',
        createdAt: new Date('2026-09-20T08:20:46.408Z'),
      },
    });
  });

  it('does not expose the user password or other unexpected properties', () => {
    const user = new UserResponseDto();

    Object.assign(user, {
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

    const dto = new AuthResponseDto();

    Object.assign(dto, {
      accessToken: 'access-token',
      user,
      refreshToken: 'should-not-be-exposed',
    });

    const result = instanceToPlain(dto, { excludeExtraneousValues: true });

    expect(result).not.toHaveProperty('refreshToken');
    expect((result as { user: object }).user).not.toHaveProperty('password');
    expect((result as { user: object }).user).not.toHaveProperty(
      'tokenVersion',
    );
    expect((result as { user: object }).user).not.toHaveProperty('isActive');
  });
});

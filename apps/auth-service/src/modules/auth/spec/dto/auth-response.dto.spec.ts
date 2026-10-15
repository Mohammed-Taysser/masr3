import { instanceToPlain } from 'class-transformer';

import AuthResponseDto from '../../dto/auth-response.dto';
import UserResponseDto from '../../../users/dto/user-response.dto';
import { UserRoleEnum } from '@masr3/libs/auth';

describe('AuthResponseDto', () => {
  it('exposes both tokens, their type, the lifetime and the nested user', () => {
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
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: 300,
      user,
    });

    const result = instanceToPlain(dto);

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: 300,
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
      internalNote: 'should-not-be-exposed',
    });

    const result = instanceToPlain(dto, { excludeExtraneousValues: true });

    expect(result).not.toHaveProperty('internalNote');
    expect((result as { user: object }).user).not.toHaveProperty('password');
    expect((result as { user: object }).user).not.toHaveProperty(
      'tokenVersion',
    );
    expect((result as { user: object }).user).not.toHaveProperty('isActive');
  });
});

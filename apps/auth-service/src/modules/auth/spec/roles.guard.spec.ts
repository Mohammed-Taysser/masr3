import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import RolesGuard from '../guards/roles.guard';
import { UserRoleEnum } from '../../users/users.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const createContext = (user?: { role: UserRoleEnum }) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows the request when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = guard.canActivate(
      createContext({ role: UserRoleEnum.CUSTOMER }),
    );

    expect(result).toBe(true);
  });

  it('allows the request when the required roles list is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    const result = guard.canActivate(
      createContext({ role: UserRoleEnum.CUSTOMER }),
    );

    expect(result).toBe(true);
  });

  it('allows the request when the user has one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRoleEnum.ADMIN]);

    const result = guard.canActivate(
      createContext({ role: UserRoleEnum.ADMIN }),
    );

    expect(result).toBe(true);
  });

  it('denies the request when the user does not have a required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRoleEnum.ADMIN]);

    const result = guard.canActivate(
      createContext({ role: UserRoleEnum.CUSTOMER }),
    );

    expect(result).toBe(false);
  });

  it('denies the request when there is no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRoleEnum.ADMIN]);

    const result = guard.canActivate(createContext(undefined));

    expect(result).toBe(false);
  });
});

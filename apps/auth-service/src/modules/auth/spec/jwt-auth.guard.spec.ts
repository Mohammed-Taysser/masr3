import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import JwtAuthGuard from '../guards/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  const handler = jest.fn();
  const controllerClass = jest.fn();

  const context = {
    getHandler: () => handler,
    getClass: () => controllerClass,
  } as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new JwtAuthGuard(reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reads the isPublic metadata from the handler and the class', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      handler,
      controllerClass,
    ]);
  });

  it('allows a route marked @Public() without authenticating', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('delegates to passport when the route is not public', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const parent = jest
      .spyOn(
        Object.getPrototypeOf(JwtAuthGuard.prototype) as {
          canActivate: (context: ExecutionContext) => boolean;
        },
        'canActivate',
      )
      .mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
    expect(parent).toHaveBeenCalledWith(context);

    parent.mockRestore();
  });

  it('delegates to passport when the metadata is absent', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const parent = jest
      .spyOn(
        Object.getPrototypeOf(JwtAuthGuard.prototype) as {
          canActivate: (context: ExecutionContext) => boolean;
        },
        'canActivate',
      )
      .mockReturnValue(false);

    expect(guard.canActivate(context)).toBe(false);
    expect(parent).toHaveBeenCalledWith(context);

    parent.mockRestore();
  });
});

import 'reflect-metadata';

import { Roles, ROLES_KEY } from '../decorators/roles.decorator';
import { UserRoleEnum } from '../../users/users.enum';

describe('Roles decorator', () => {
  it('sets the roles metadata on the handler', () => {
    class Target {
      @Roles(UserRoleEnum.ADMIN)
      handler() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, Target.prototype.handler);

    expect(metadata).toEqual([UserRoleEnum.ADMIN]);
  });

  it('supports multiple roles', () => {
    class Target {
      @Roles(UserRoleEnum.ADMIN, UserRoleEnum.RIDER)
      handler() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, Target.prototype.handler);

    expect(metadata).toEqual([UserRoleEnum.ADMIN, UserRoleEnum.RIDER]);
  });

  it('sets an empty array when called with no roles', () => {
    class Target {
      @Roles()
      handler() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, Target.prototype.handler);

    expect(metadata).toEqual([]);
  });
});

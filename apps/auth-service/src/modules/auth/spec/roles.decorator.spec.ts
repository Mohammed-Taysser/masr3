import 'reflect-metadata';

import { Roles, ROLES_KEY } from '../decorators/roles.decorator';
import { UserRoleEnum } from '../../users/users.enum';

describe('Roles decorator', () => {
  it('sets the roles metadata on the handler', () => {
    class Target {
      @Roles(UserRoleEnum.ADMIN)
      handler() {
        // Exists only to carry the decorator.
      }
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, Target.prototype.handler);

    expect(metadata).toEqual([UserRoleEnum.ADMIN]);
  });

  it('supports multiple roles', () => {
    class Target {
      @Roles(UserRoleEnum.ADMIN, UserRoleEnum.DRIVER)
      handler() {
        // Exists only to carry the decorator.
      }
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, Target.prototype.handler);

    expect(metadata).toEqual([UserRoleEnum.ADMIN, UserRoleEnum.DRIVER]);
  });

  it('sets an empty array when called with no roles', () => {
    class Target {
      @Roles()
      handler() {
        // Exists only to carry the decorator.
      }
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, Target.prototype.handler);

    expect(metadata).toEqual([]);
  });
});

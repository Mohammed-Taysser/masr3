import { SetMetadata } from '@nestjs/common';

import { UserRoleEnum } from '../../users/users.enum';

const ROLES_KEY = 'roles';

const Roles = (...roles: UserRoleEnum[]) => SetMetadata(ROLES_KEY, roles);

export { Roles, ROLES_KEY };

import { Injectable } from '@nestjs/common';

import type { AuthenticatedUser, UserPrincipalValidator } from '@masr3/libs';

import UsersService from './users.service';

// Keeps revocation immediate on auth-service's own routes. Database errors are
// left to propagate: an outage is not an invalid token.
@Injectable()
class ActiveUserValidator implements UserPrincipalValidator {
  constructor(private readonly usersService: UsersService) {}

  async isCurrent(user: AuthenticatedUser): Promise<boolean> {
    const storedUser = await this.usersService.findById(user.id);

    const isActive = storedUser?.isActive === true;
    const hasCurrentVersion = storedUser?.tokenVersion === user.tokenVersion;

    return isActive && hasCurrentVersion;
  }
}

export default ActiveUserValidator;

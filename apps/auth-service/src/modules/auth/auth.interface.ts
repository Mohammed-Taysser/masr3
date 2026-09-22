import { UserRoleEnum } from '../users/users.enum';

interface AuthenticatedUser {
  id: number;
  email: string;
  role: UserRoleEnum;
}

interface JwtPayload {
  sub: number;
  email: string;
  role: UserRoleEnum;
  tokenVersion: number;
}

export type { AuthenticatedUser, JwtPayload };

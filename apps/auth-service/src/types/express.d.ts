import { AuthenticatedUser } from '../modules/auth/auth.interface';

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

export {};

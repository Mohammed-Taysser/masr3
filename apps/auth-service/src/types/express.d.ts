import { AuthenticatedUser } from '../modules/auth/auth.interface';

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}

    // Declared here rather than relying on @types/passport, which is only
    // pulled in transitively and so is absent from builds that do not import
    // @nestjs/passport.
    interface Request {
      user?: User | undefined;
    }
  }
}

export {};

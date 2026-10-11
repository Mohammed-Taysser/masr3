import { AuthenticatedUser } from '../modules/auth/auth.interface';

declare global {
  namespace Express {
    // Empty on purpose: declaration merging is how Express's own `User` type
    // becomes ours. A type alias cannot merge, so this has to be an interface.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
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

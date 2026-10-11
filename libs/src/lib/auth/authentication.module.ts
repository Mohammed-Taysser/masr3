import { DynamicModule, Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { KEY_RESOLVER, USER_PRINCIPAL_VALIDATOR } from './auth.constant';
import type { AuthenticationModuleOptions } from './auth.interface';
import AuthenticationGuard from './authentication.guard';
import JwksKeyResolver from './jwks-key.resolver';
import TokenVerifierService from './token-verifier.service';

// The guard is not registered here: each app.module adds it as APP_GUARD
// after its throttler, so guard order stays explicit.
@Module({})
class AuthenticationModule {
  static register(options: AuthenticationModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      TokenVerifierService,
      AuthenticationGuard,
      {
        provide: KEY_RESOLVER,
        useClass: options.keyResolver ?? JwksKeyResolver,
      },
    ];

    if (options.userValidator) {
      providers.push({
        provide: USER_PRINCIPAL_VALIDATOR,
        useClass: options.userValidator,
      });
    }

    return {
      module: AuthenticationModule,
      global: true,
      imports: [JwtModule.register({}), ...(options.imports ?? [])],
      providers,
      exports: [TokenVerifierService, AuthenticationGuard],
    };
  }
}

export default AuthenticationModule;

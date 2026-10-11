import { Injectable, UnauthorizedException } from '@nestjs/common';

import type { KeyResolver } from '@masr3/libs';

import SigningKeyService from './signing-key.service';

// auth-service verifies against its own keys instead of fetching its own JWKS.
@Injectable()
class LocalKeyResolver implements KeyResolver {
  constructor(private readonly signingKeyService: SigningKeyService) {}

  async getPublicKey(keyId: string): Promise<string> {
    const publicKeyPem = this.signingKeyService.getPublicKeyPem(keyId);

    if (!publicKeyPem) {
      throw new UnauthorizedException('Invalid access token');
    }

    return publicKeyPem;
  }
}

export default LocalKeyResolver;

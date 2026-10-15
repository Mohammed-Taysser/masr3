import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JWKS_PATH, Public } from '@masr3/libs/auth';

import { JWKS_CACHE_CONTROL } from './signing-key.constant';
import SigningKeyService from './signing-key.service';

@ApiTags('Keys')
@Controller()
class JwksController {
  constructor(private readonly signingKeyService: SigningKeyService) {}

  @Get(JWKS_PATH)
  @Public()
  @Header('Cache-Control', JWKS_CACHE_CONTROL)
  @ApiOperation({
    summary: 'Public signing keys (JWKS)',
    description:
      'The RS256 public keys that verify every access, refresh and service token. During a key rotation it lists both the current and the previous key. It never contains private key material.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        keys: [
          {
            kty: 'RSA',
            n: '0vx7agoebGcQSuuPiLJXZpt...',
            e: 'AQAB',
            kid: 'NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs',
            use: 'sig',
            alg: 'RS256',
          },
        ],
      },
    },
  })
  jwks() {
    return this.signingKeyService.jwks();
  }
}

export default JwksController;

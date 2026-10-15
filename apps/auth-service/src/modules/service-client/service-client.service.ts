import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

import {
  BEARER_TOKEN_TYPE,
  REFRESH_TOKEN_AUDIENCE,
  SERVICE_CLIENT_SECRET_PATTERN,
  ServiceTokenClaims,
  TokenUseEnum,
  USER_TOKEN_AUDIENCE,
} from '@masr3/libs/auth';

import SigningKeyService from '../signing-key/signing-key.service';
import CreateServiceTokenDto from './dto/create-service-token.dto';
import ServiceTokenResponseDto from './dto/service-token-response.dto';
import {
  BASE64_PATTERN,
  BASIC_SCHEME_PATTERN,
  SERVICE_CLIENTS,
} from './service-client.constant';
import type {
  BasicCredentials,
  RegisteredClient,
} from './service-client.interface';

@Injectable()
class ServiceClientService {
  private readonly logger = new Logger(ServiceClientService.name);
  // A Map, not the registry object, so names like `constructor` never resolve.
  private readonly clients = new Map<string, RegisteredClient>();
  private readonly expiresIn: number;

  constructor(
    configService: ConfigService,
    private readonly signingKeyService: SigningKeyService,
  ) {
    this.expiresIn = configService.getOrThrow<number>(
      'SERVICE_TOKEN_EXPIRES_IN_SECONDS',
    );

    for (const [name, client] of Object.entries(SERVICE_CLIENTS)) {
      const secret = configService.get<string>(client.secretVariable);

      const isValidSecret =
        typeof secret === 'string' &&
        SERVICE_CLIENT_SECRET_PATTERN.test(secret);

      if (!isValidSecret) {
        throw new Error(
          `${client.secretVariable} must be 64 lowercase hex characters (openssl rand -hex 32)`,
        );
      }

      const listsUserAudience = client.audiences.some(
        (audience) =>
          audience === USER_TOKEN_AUDIENCE ||
          audience === REFRESH_TOKEN_AUDIENCE,
      );

      if (listsUserAudience) {
        throw new Error(
          `Service client ${name} lists a user or refresh token audience`,
        );
      }

      this.clients.set(name, { ...client, secretDigest: this.digest(secret) });
    }
  }

  issueToken(
    authorization: string | undefined,
    dto: CreateServiceTokenDto,
  ): ServiceTokenResponseDto {
    const credentials = this.parseBasicCredentials(authorization);
    const client = credentials
      ? this.clients.get(credentials.username)
      : undefined;
    const isAuthenticated =
      client !== undefined &&
      timingSafeEqual(this.digest(credentials.password), client.secretDigest);

    if (!isAuthenticated) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    const clientName = credentials.username;
    const isAudienceAllowed = client.audiences.includes(dto.audience);
    const areScopesAllowed = dto.scopes.every((scope) =>
      client.scopes.includes(scope),
    );

    if (!isAudienceAllowed) {
      throw new ForbiddenException(
        `Audience ${dto.audience} is not allowed for ${clientName}`,
      );
    }

    if (!areScopesAllowed) {
      throw new ForbiddenException(
        `A requested scope is not allowed for ${clientName}`,
      );
    }

    const scopes = [...new Set(dto.scopes)];
    const claims: ServiceTokenClaims = {
      sub: clientName,
      tokenUse: TokenUseEnum.SERVICE,
      scopes,
    };
    const accessToken = this.signingKeyService.sign(
      claims,
      dto.audience,
      this.expiresIn,
    );

    this.logger.log(
      `Issued a service token to ${clientName} for ${dto.audience} with ${scopes.join(', ')}`,
    );

    return {
      accessToken,
      tokenType: BEARER_TOKEN_TYPE,
      expiresIn: this.expiresIn,
    };
  }

  // Returns null for anything that is not a well-formed Basic header, so the
  // caller can answer with one uniform 401.
  private parseBasicCredentials(
    authorization: string | undefined,
  ): BasicCredentials | null {
    const encoded = authorization
      ? BASIC_SCHEME_PATTERN.exec(authorization)?.[1]
      : undefined;
    const isBase64 =
      encoded !== undefined &&
      encoded.length % 4 === 0 &&
      BASE64_PATTERN.test(encoded);

    if (!isBase64) {
      return null;
    }

    const decodedBytes = Buffer.from(encoded, 'base64');
    // Node decodes malformed base64 leniently; a round trip catches it.
    const isCanonical = decodedBytes.toString('base64') === encoded;

    if (!isCanonical) {
      return null;
    }

    const decoded = decodedBytes.toString('utf8');
    const separator = decoded.indexOf(':');
    const hasUsername = separator > 0;
    const hasPassword = separator !== -1 && separator < decoded.length - 1;

    if (!hasUsername || !hasPassword) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  }

  private digest(value: string): Buffer {
    return createHash('sha256').update(value).digest();
  }
}

export default ServiceClientService;

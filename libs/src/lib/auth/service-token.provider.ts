import {
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

import { dayjs } from '../date/dayjs';
import {
  BEARER_TOKEN_TYPE,
  INTERNAL_HTTP_TIMEOUT_MS,
  SERVICE_TOKEN_REFRESH_MARGIN_MS,
  SERVICE_TOKENS_PATH,
} from './auth.constant';
import { ServiceScopeEnum } from './auth.enum';
import type {
  CachedServiceToken,
  ServiceTokenResponse,
} from './auth.interface';

@Injectable()
class ServiceTokenProvider {
  private readonly logger = new Logger(ServiceTokenProvider.name);
  private readonly tokenUrl: string;
  private readonly authorization: string;
  private readonly cache = new Map<string, CachedServiceToken>();
  private readonly inFlight = new Map<string, Promise<string>>();

  constructor(configService: ConfigService) {
    const authServiceUrl = configService.getOrThrow<string>('AUTH_SERVICE_URL');
    const clientName = configService.getOrThrow<string>('SERVICE_NAME');
    const clientSecret = configService.getOrThrow<string>(
      'SERVICE_CLIENT_SECRET',
    );

    this.tokenUrl = `${authServiceUrl}/${SERVICE_TOKENS_PATH}`;
    this.authorization = `Basic ${Buffer.from(`${clientName}:${clientSecret}`).toString('base64')}`;
  }

  async getToken(
    audience: string,
    scopes: ServiceScopeEnum[],
  ): Promise<string> {
    const sortedScopes = [...new Set(scopes)].sort();
    const cacheKey = `${audience}|${sortedScopes.join(' ')}`;
    const cached = this.cache.get(cacheKey);

    const refreshAt = cached
      ? cached.expiresAt - SERVICE_TOKEN_REFRESH_MARGIN_MS
      : 0;
    const isCachedTokenUsable = dayjs().valueOf() < refreshAt;

    if (cached && isCachedTokenUsable) {
      return cached.accessToken;
    }

    const pending = this.inFlight.get(cacheKey);

    if (pending) {
      return pending;
    }

    const request = this.requestToken(audience, sortedScopes, cacheKey).finally(
      () => this.inFlight.delete(cacheKey),
    );

    this.inFlight.set(cacheKey, request);

    return request;
  }

  private async requestToken(
    audience: string,
    scopes: ServiceScopeEnum[],
    cacheKey: string,
  ): Promise<string> {
    const requestedAt = dayjs();
    let response: AxiosResponse<unknown>;

    try {
      response = await axios.post<unknown>(
        this.tokenUrl,
        { audience, scopes },
        {
          headers: { Authorization: this.authorization },
          timeout: INTERNAL_HTTP_TIMEOUT_MS,
          maxRedirects: 0,
          validateStatus: () => true,
        },
      );
    } catch {
      this.logger.error(
        `Service token for ${audience} failed: network error or timeout`,
      );

      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    }

    if (response.status !== HttpStatus.OK) {
      this.logger.error(
        `Service token for ${audience} failed: ${this.describeFailure(response.status)}`,
      );

      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    }

    if (!this.isServiceTokenResponse(response.data)) {
      this.logger.error(
        `Service token for ${audience} failed: malformed response body`,
      );

      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    }

    const { accessToken, expiresIn } = response.data;

    this.cache.set(cacheKey, {
      accessToken,
      expiresAt: requestedAt.add(expiresIn, 'second').valueOf(),
    });

    return accessToken;
  }

  private isServiceTokenResponse(
    value: unknown,
  ): value is ServiceTokenResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const body = value as Record<string, unknown>;
    const expiresIn = body['expiresIn'];

    return (
      typeof body['accessToken'] === 'string' &&
      body['accessToken'].length > 0 &&
      body['tokenType'] === BEARER_TOKEN_TYPE &&
      Number.isInteger(expiresIn) &&
      (expiresIn as number) > 0
    );
  }

  private describeFailure(status: number): string {
    if (status === HttpStatus.UNAUTHORIZED) {
      return 'client credentials rejected';
    }

    if (status === HttpStatus.FORBIDDEN) {
      return 'audience or scope not allowed';
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return `auth-service error ${status}`;
    }

    return `unexpected status ${status}`;
  }
}

export default ServiceTokenProvider;

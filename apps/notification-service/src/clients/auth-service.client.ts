import {
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

import {
  INTERNAL_HTTP_TIMEOUT_MS,
  ServiceScopeEnum,
  ServiceTokenProvider,
  UserContact,
} from '@masr3/libs';

import { AUTH_SERVICE_AUDIENCE } from './auth-service-client.constant';

@Injectable()
class AuthServiceClient {
  private readonly logger = new Logger(AuthServiceClient.name);
  private readonly authServiceUrl: string;

  constructor(
    configService: ConfigService,
    private readonly serviceTokenProvider: ServiceTokenProvider,
  ) {
    this.authServiceUrl = configService.getOrThrow<string>('AUTH_SERVICE_URL');
  }

  async getUserContact(userId: number): Promise<UserContact | null> {
    const accessToken = await this.serviceTokenProvider.getToken(
      AUTH_SERVICE_AUDIENCE,
      [ServiceScopeEnum.USERS_CONTACT_READ],
    );
    let response: AxiosResponse<unknown>;

    try {
      response = await axios.get<unknown>(
        `${this.authServiceUrl}/internal/users/${userId}/contact`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: INTERNAL_HTTP_TIMEOUT_MS,
          maxRedirects: 0,
          validateStatus: () => true,
        },
      );
    } catch {
      this.logger.error(
        `Contact lookup for user ${userId} failed: network error or timeout`,
      );

      throw new ServiceUnavailableException('auth-service unavailable');
    }

    if (response.status === HttpStatus.NOT_FOUND) {
      return null;
    }

    if (response.status !== HttpStatus.OK) {
      this.logger.error(
        `Contact lookup for user ${userId} failed: status ${response.status}`,
      );

      throw new ServiceUnavailableException('auth-service unavailable');
    }

    if (!this.isUserContact(response.data)) {
      this.logger.error(
        `Contact lookup for user ${userId} failed: malformed response body`,
      );

      throw new ServiceUnavailableException('auth-service unavailable');
    }

    return response.data;
  }

  private isUserContact(value: unknown): value is UserContact {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const body = value as Record<string, unknown>;

    return (
      Number.isInteger(body['userId']) &&
      typeof body['email'] === 'string' &&
      typeof body['firstName'] === 'string' &&
      typeof body['lastName'] === 'string'
    );
  }
}

export default AuthServiceClient;

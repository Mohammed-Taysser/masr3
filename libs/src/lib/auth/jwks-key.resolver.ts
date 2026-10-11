import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createPublicKey, KeyObject } from 'node:crypto';

import { dayjs } from '../date/dayjs';
import {
  INTERNAL_HTTP_TIMEOUT_MS,
  JWKS_CACHE_TTL_MS,
  JWKS_FETCH_COOLDOWN_MS,
  JWKS_MAX_STALE_MS,
  JWKS_PATH,
  JWT_ALGORITHM,
  MINIMUM_RSA_MODULUS_BITS,
  PRIVATE_JWK_PARAMETERS,
} from './auth.constant';
import type { JsonObject, KeyResolver } from './auth.interface';

@Injectable()
class JwksKeyResolver implements KeyResolver {
  private readonly logger = new Logger(JwksKeyResolver.name);
  private readonly jwksUrl: string;

  private keySet: Map<string, string> | null = null;
  private setFetchedAt = 0;
  private lastAttemptAt: number | null = null;
  private lastAttemptSucceeded = false;
  private inFlight: Promise<void> | null = null;

  constructor(configService: ConfigService) {
    this.jwksUrl = `${configService.getOrThrow<string>('AUTH_SERVICE_URL')}/${JWKS_PATH}`;
  }

  async getPublicKey(keyId: string): Promise<string> {
    const cached = this.keySet?.get(keyId);
    const isSetFresh =
      dayjs().valueOf() - this.setFetchedAt < JWKS_CACHE_TTL_MS;

    if (cached && isSetFresh) {
      return cached;
    }

    const canFetch = this.inFlight !== null || this.cooldownElapsed();

    if (canFetch) {
      await this.refresh();
    }

    const key = this.unexpiredKey(keyId);

    if (key) {
      if (!this.lastAttemptSucceeded) {
        this.logger.warn(`Verifying with a stale JWKS key ${keyId}`);
      }

      return key;
    }

    // A published set without the key means the token is bad; no usable set
    // means verification itself is unavailable.
    if (this.lastAttemptSucceeded) {
      throw new UnauthorizedException('Invalid access token');
    }

    throw new ServiceUnavailableException(
      'Token verification is temporarily unavailable',
    );
  }

  private cooldownElapsed(): boolean {
    return (
      this.lastAttemptAt === null ||
      dayjs().valueOf() - this.lastAttemptAt >= JWKS_FETCH_COOLDOWN_MS
    );
  }

  private unexpiredKey(keyId: string): string | undefined {
    const isTooStale =
      dayjs().valueOf() - this.setFetchedAt >= JWKS_MAX_STALE_MS;

    if (!this.keySet || isTooStale) {
      return undefined;
    }

    return this.keySet.get(keyId);
  }

  private refresh(): Promise<void> {
    if (!this.inFlight) {
      this.inFlight = this.fetchKeySet().finally(() => {
        this.inFlight = null;
      });
    }

    return this.inFlight;
  }

  private async fetchKeySet(): Promise<void> {
    const attemptedAt = dayjs().valueOf();

    this.lastAttemptAt = attemptedAt;

    try {
      const response = await axios.get<unknown>(this.jwksUrl, {
        timeout: INTERNAL_HTTP_TIMEOUT_MS,
        maxRedirects: 0,
        validateStatus: () => true,
      });

      if (response.status !== 200) {
        throw new Error(`JWKS responded with status ${response.status}`);
      }

      this.keySet = this.parseKeySet(response.data);
      this.setFetchedAt = attemptedAt;
      this.lastAttemptSucceeded = true;
    } catch (error) {
      this.lastAttemptSucceeded = false;
      this.logger.warn(
        `JWKS fetch failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private parseKeySet(document: unknown): Map<string, string> {
    const hasKeyList =
      this.isJsonObject(document) && Array.isArray(document['keys']);

    if (!hasKeyList) {
      throw new Error('JWKS document is malformed');
    }

    const keys = new Map<string, string>();

    for (const jwk of document['keys'] as unknown[]) {
      if (!this.isJsonObject(jwk)) {
        this.logger.warn('Ignoring a JWKS entry that is not an object');
        continue;
      }

      const hasPrivateMaterial = PRIVATE_JWK_PARAMETERS.some(
        (parameter) => parameter in jwk,
      );

      if (hasPrivateMaterial) {
        throw new Error('JWKS document contains private key material');
      }

      if (!this.isRs256SigningKey(jwk)) {
        this.logger.warn('Ignoring a JWKS key unusable for RS256 signatures');
        continue;
      }

      const keyId = jwk.kid;

      let publicKey: KeyObject;

      try {
        publicKey = createPublicKey({ key: jwk, format: 'jwk' });
      } catch {
        this.logger.warn(`Ignoring JWKS key ${keyId}: invalid key material`);
        continue;
      }

      const isLongEnough =
        (publicKey.asymmetricKeyDetails?.modulusLength ?? 0) >=
        MINIMUM_RSA_MODULUS_BITS;

      if (!isLongEnough) {
        this.logger.warn(`Ignoring JWKS key ${keyId}: modulus too short`);
        continue;
      }

      if (keys.has(keyId)) {
        throw new Error(`JWKS document repeats key id ${keyId}`);
      }

      keys.set(
        keyId,
        publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      );
    }

    if (keys.size === 0) {
      throw new Error('JWKS document has no usable keys');
    }

    return keys;
  }

  private isRs256SigningKey(
    jwk: JsonObject,
  ): jwk is JsonObject & { kid: string } {
    const keyId = jwk['kid'];
    const hasKeyId = typeof keyId === 'string' && keyId.length > 0;
    const isSignatureKey = jwk['use'] === undefined || jwk['use'] === 'sig';
    const isRs256 = jwk['alg'] === undefined || jwk['alg'] === JWT_ALGORITHM;

    return jwk['kty'] === 'RSA' && hasKeyId && isSignatureKey && isRs256;
  }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

export default JwksKeyResolver;

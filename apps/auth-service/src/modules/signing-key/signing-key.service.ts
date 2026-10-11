import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  KeyObject,
} from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  JWT_ALGORITHM,
  MINIMUM_RSA_MODULUS_BITS,
  TOKEN_ISSUER,
} from '@masr3/libs';

import { JWK_SIGNATURE_USE, RSA_KEY_TYPE } from './signing-key.constant';
import type { PublicJsonWebKey, PublishedKey } from './signing-key.interface';

@Injectable()
class SigningKeyService {
  readonly privateKey: KeyObject;
  readonly currentKeyId: string;

  private readonly publishedKeys = new Map<string, PublishedKey>();

  constructor(
    configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.privateKey = createPrivateKey(
      readFileSync(configService.getOrThrow<string>('JWT_PRIVATE_KEY_FILE')),
    );
    this.assertSigningKey(this.privateKey, 'JWT_PRIVATE_KEY_FILE');
    this.currentKeyId = this.publish(createPublicKey(this.privateKey));

    const previousKeyFile = configService.get<string>(
      'JWT_PREVIOUS_PUBLIC_KEY_FILE',
    );

    if (previousKeyFile) {
      const previousKey = createPublicKey(readFileSync(previousKeyFile));

      this.assertSigningKey(previousKey, 'JWT_PREVIOUS_PUBLIC_KEY_FILE');

      const isCurrentKey = this.publishedKeys.has(this.keyIdOf(previousKey));

      if (isCurrentKey) {
        throw new Error(
          'JWT_PREVIOUS_PUBLIC_KEY_FILE must differ from the current signing key',
        );
      }

      this.publish(previousKey);
    }
  }

  sign(claims: object, audience: string, expiresInSeconds: number): string {
    return this.jwtService.sign(claims, {
      algorithm: JWT_ALGORITHM,
      privateKey: this.privateKey,
      keyid: this.currentKeyId,
      issuer: TOKEN_ISSUER,
      audience,
      expiresIn: expiresInSeconds,
    });
  }

  getPublicKeyPem(keyId: string): string | null {
    return this.publishedKeys.get(keyId)?.pem ?? null;
  }

  jwks(): { keys: PublicJsonWebKey[] } {
    return { keys: [...this.publishedKeys.values()].map(({ jwk }) => jwk) };
  }

  private assertSigningKey(key: KeyObject, variable: string): void {
    const isRsaKey = key.asymmetricKeyType === 'rsa';
    const isLongEnough =
      (key.asymmetricKeyDetails?.modulusLength ?? 0) >=
      MINIMUM_RSA_MODULUS_BITS;

    if (!isRsaKey || !isLongEnough) {
      throw new Error(
        `${variable} must be an RSA key of at least ${MINIMUM_RSA_MODULUS_BITS} bits`,
      );
    }
  }

  // RFC 7638 thumbprint: the required members in lexicographic order.
  private keyIdOf(publicKey: KeyObject): string {
    const { e, kty, n } = publicKey.export({ format: 'jwk' });

    return createHash('sha256')
      .update(JSON.stringify({ e, kty, n }))
      .digest('base64url');
  }

  private publish(publicKey: KeyObject): string {
    const { n, e } = publicKey.export({ format: 'jwk' });
    const keyId = this.keyIdOf(publicKey);

    this.publishedKeys.set(keyId, {
      pem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      jwk: {
        kty: RSA_KEY_TYPE,
        n,
        e,
        kid: keyId,
        use: JWK_SIGNATURE_USE,
        alg: JWT_ALGORITHM,
      },
    });

    return keyId;
  }
}

export default SigningKeyService;

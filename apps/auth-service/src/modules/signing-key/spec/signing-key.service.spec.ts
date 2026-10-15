import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
  verify as verifySignature,
} from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { TOKEN_ISSUER, USER_TOKEN_AUDIENCE } from '@masr3/libs/auth';

import LocalKeyResolver from '../local-key.resolver';
import SigningKeyService from '../signing-key.service';

describe('SigningKeyService', () => {
  let directory: string;
  let currentPrivateFile: string;
  let previousPublicFile: string;
  let weakPrivateFile: string;
  let ecPrivateFile: string;
  let currentPublicFile: string;
  let previousPrivateKey: KeyObject;

  const writePem = (name: string, pem: string | Buffer) => {
    const file = join(directory, name);

    writeFileSync(file, pem);

    return file;
  };

  const create = (config: Record<string, string | undefined>) =>
    new SigningKeyService(
      {
        getOrThrow: (key: string) => config[key],
        get: (key: string) => config[key],
      } as unknown as ConfigService,
      new JwtService(),
    );

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'signing-key-'));

    const current = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const previous = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const weak = generateKeyPairSync('rsa', { modulusLength: 1024 });
    const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

    previousPrivateKey = previous.privateKey;
    currentPrivateFile = writePem(
      'current.private.pem',
      current.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    );
    currentPublicFile = writePem(
      'current.public.pem',
      current.publicKey.export({ type: 'spki', format: 'pem' }),
    );
    previousPublicFile = writePem(
      'previous.public.pem',
      previous.publicKey.export({ type: 'spki', format: 'pem' }),
    );
    weakPrivateFile = writePem(
      'weak.private.pem',
      weak.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    );
    ecPrivateFile = writePem(
      'ec.private.pem',
      ec.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    );
  });

  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  it('derives a stable RFC 7638 key id', () => {
    const first = create({ JWT_PRIVATE_KEY_FILE: currentPrivateFile });
    const second = create({ JWT_PRIVATE_KEY_FILE: currentPrivateFile });

    expect(first.currentKeyId).toBe(second.currentKeyId);
    expect(first.currentKeyId).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('publishes only public members in the JWKS', () => {
    const service = create({
      JWT_PRIVATE_KEY_FILE: currentPrivateFile,
      JWT_PREVIOUS_PUBLIC_KEY_FILE: previousPublicFile,
    });
    const { keys } = service.jwks();

    expect(keys).toHaveLength(2);
    keys.forEach((jwk) => {
      expect(Object.keys(jwk).sort()).toEqual(
        ['alg', 'e', 'kid', 'kty', 'n', 'use'].sort(),
      );
      expect(jwk).toMatchObject({ kty: 'RSA', use: 'sig', alg: 'RS256' });
    });
    expect(JSON.stringify(keys)).not.toMatch(/"(d|p|q|dp|dq|qi)"/);
  });

  it('resolves the current and the previous key by exact kid only', () => {
    const service = create({
      JWT_PRIVATE_KEY_FILE: currentPrivateFile,
      JWT_PREVIOUS_PUBLIC_KEY_FILE: previousPublicFile,
    });
    const previousKeyId = service
      .jwks()
      .keys.find((key) => key.kid !== service.currentKeyId).kid;

    expect(service.getPublicKeyPem(service.currentKeyId)).toContain(
      'BEGIN PUBLIC KEY',
    );
    expect(service.getPublicKeyPem(previousKeyId)).toBe(
      createPublicKey(previousPrivateKey)
        .export({ type: 'spki', format: 'pem' })
        .toString(),
    );
    expect(service.getPublicKeyPem('unknown')).toBeNull();
    expect(service.getPublicKeyPem(service.currentKeyId.slice(1))).toBeNull();
  });

  it('signs RS256 tokens with the current kid, issuer and audience', () => {
    const service = create({ JWT_PRIVATE_KEY_FILE: currentPrivateFile });
    const token = service.sign({ sub: '1' }, USER_TOKEN_AUDIENCE, 300);
    const [header, payload, signature] = token.split('.');
    const decodedHeader = JSON.parse(
      Buffer.from(header, 'base64url').toString(),
    );
    const decodedPayload = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    );

    expect(decodedHeader).toMatchObject({
      alg: 'RS256',
      kid: service.currentKeyId,
    });
    expect(decodedPayload).toMatchObject({
      sub: '1',
      iss: TOKEN_ISSUER,
      aud: USER_TOKEN_AUDIENCE,
    });
    expect(decodedPayload.exp - decodedPayload.iat).toBe(300);
    expect(
      verifySignature(
        'RSA-SHA256',
        Buffer.from(`${header}.${payload}`),
        service.getPublicKeyPem(service.currentKeyId),
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
  });

  describe('fails at boot', () => {
    it.each([
      ['a weak key', () => ({ JWT_PRIVATE_KEY_FILE: weakPrivateFile })],
      ['a non-RSA key', () => ({ JWT_PRIVATE_KEY_FILE: ecPrivateFile })],
      [
        'a missing file',
        () => ({ JWT_PRIVATE_KEY_FILE: join(directory, 'missing.pem') }),
      ],
      [
        'a garbage file',
        () => ({
          JWT_PRIVATE_KEY_FILE: writePem('garbage.pem', 'not a key'),
        }),
      ],
      [
        'a previous key equal to the current one',
        () => ({
          JWT_PRIVATE_KEY_FILE: currentPrivateFile,
          JWT_PREVIOUS_PUBLIC_KEY_FILE: currentPublicFile,
        }),
      ],
      [
        'a weak previous key',
        () => ({
          JWT_PRIVATE_KEY_FILE: currentPrivateFile,
          JWT_PREVIOUS_PUBLIC_KEY_FILE: writePem(
            'weak.public.pem',
            createPublicKey(
              generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey,
            ).export({ type: 'spki', format: 'pem' }),
          ),
        }),
      ],
    ])('on %s', (_case, config) => {
      expect(() => create(config())).toThrow();
    });
  });

  describe('LocalKeyResolver', () => {
    it('resolves the previous key while it is configured, and nothing else', async () => {
      const service = create({
        JWT_PRIVATE_KEY_FILE: currentPrivateFile,
        JWT_PREVIOUS_PUBLIC_KEY_FILE: previousPublicFile,
      });
      const resolver = new LocalKeyResolver(service);
      const previousKeyId = service
        .jwks()
        .keys.find((key) => key.kid !== service.currentKeyId).kid;

      await expect(resolver.getPublicKey(previousKeyId)).resolves.toContain(
        'BEGIN PUBLIC KEY',
      );
      await expect(resolver.getPublicKey('unknown')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});

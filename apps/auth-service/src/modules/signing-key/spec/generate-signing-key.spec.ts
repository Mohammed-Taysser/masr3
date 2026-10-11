import { createPrivateKey, createPublicKey } from 'node:crypto';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { generateSigningKey } from '../generate-signing-key';

describe('generateSigningKey', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(join(tmpdir(), 'generate-key-'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('writes a valid 2048-bit pair with mode 600', () => {
    const { privateKeyFile, publicKeyFile } = generateSigningKey(
      'jwt',
      join(directory, 'secrets'),
    );
    const privateKey = createPrivateKey(fs.readFileSync(privateKeyFile));
    const publicKey = createPublicKey(fs.readFileSync(publicKeyFile));

    expect(privateKey.asymmetricKeyDetails?.modulusLength).toBe(2048);
    expect(createPublicKey(privateKey).equals(publicKey)).toBe(true);
    expect(fs.statSync(privateKeyFile).mode & 0o777).toBe(0o600);
    expect(fs.statSync(publicKeyFile).mode & 0o777).toBe(0o600);
  });

  it.each(['../x', '', 'JWT', 'jwt.key', 'a/b'])(
    'rejects the name "%s"',
    (name) => {
      expect(() => generateSigningKey(name, directory)).toThrow(/must match/);
      expect(fs.readdirSync(directory)).toEqual([]);
    },
  );

  it('refuses to overwrite an existing key', () => {
    const { privateKeyFile } = generateSigningKey('jwt', directory);
    const original = fs.readFileSync(privateKeyFile, 'utf8');

    expect(() => generateSigningKey('jwt', directory)).toThrow(/EEXIST/);
    expect(fs.readFileSync(privateKeyFile, 'utf8')).toBe(original);
  });

  it('leaves no files behind when a step fails', () => {
    // The public half already exists, so its write fails after the private
    // half was created.
    fs.writeFileSync(join(directory, 'jwt.public.pem'), 'existing');

    expect(() => generateSigningKey('jwt', directory)).toThrow(/EEXIST/);
    expect(fs.readdirSync(directory)).toEqual(['jwt.public.pem']);
  });
});

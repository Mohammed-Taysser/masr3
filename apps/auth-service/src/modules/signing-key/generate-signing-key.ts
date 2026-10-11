import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
} from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { MINIMUM_RSA_MODULUS_BITS } from '@masr3/libs';

import {
  KEY_FILE_MODE,
  PRIVATE_KEY_SUFFIX,
  PUBLIC_KEY_SUFFIX,
  SIGNING_KEY_DIRECTORY,
  SIGNING_KEY_NAME_PATTERN,
} from './signing-key.constant';
import type { GeneratedKeyFiles } from './signing-key.interface';

function generateSigningKey(
  name: string,
  directory = SIGNING_KEY_DIRECTORY,
): GeneratedKeyFiles {
  if (!SIGNING_KEY_NAME_PATTERN.test(name)) {
    throw new Error(
      `Key name "${name}" must match ${SIGNING_KEY_NAME_PATTERN} (it becomes a file name)`,
    );
  }

  const privateKeyFile = join(directory, `${name}${PRIVATE_KEY_SUFFIX}`);
  const publicKeyFile = join(directory, `${name}${PUBLIC_KEY_SUFFIX}`);
  const created: string[] = [];

  try {
    mkdirSync(directory, { recursive: true });

    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: MINIMUM_RSA_MODULUS_BITS,
    });

    // `wx` refuses to overwrite an existing key.
    writeFileSync(
      privateKeyFile,
      privateKey.export({ type: 'pkcs8', format: 'pem' }),
      { flag: 'wx', mode: KEY_FILE_MODE },
    );
    created.push(privateKeyFile);

    writeFileSync(
      publicKeyFile,
      publicKey.export({ type: 'spki', format: 'pem' }),
      { flag: 'wx', mode: KEY_FILE_MODE },
    );
    created.push(publicKeyFile);

    const writtenPrivateKey = createPrivateKey(readFileSync(privateKeyFile));
    const writtenPublicKey = createPublicKey(readFileSync(publicKeyFile));

    const isMatchingPair =
      createPublicKey(writtenPrivateKey).equals(writtenPublicKey);
    const hasExpectedLength =
      writtenPublicKey.asymmetricKeyDetails?.modulusLength ===
      MINIMUM_RSA_MODULUS_BITS;

    if (!isMatchingPair || !hasExpectedLength) {
      throw new Error('The written key files do not validate');
    }

    return { privateKeyFile, publicKeyFile };
  } catch (error) {
    created.forEach((file) => unlinkSync(file));

    throw error;
  }
}

function main(): void {
  const nameArgument = process.argv.find((argument) =>
    argument.startsWith('--name='),
  );

  try {
    const files = generateSigningKey(
      nameArgument?.slice('--name='.length) ?? '',
    );

    console.log(`Private key: ${files.privateKeyFile}`);
    console.log(`Public key:  ${files.publicKeyFile}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

export { generateSigningKey };

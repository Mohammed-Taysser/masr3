interface PublicJsonWebKey {
  kty: string;
  n: string;
  e: string;
  kid: string;
  use: string;
  alg: string;
}

interface PublishedKey {
  pem: string;
  jwk: PublicJsonWebKey;
}

interface GeneratedKeyFiles {
  privateKeyFile: string;
  publicKeyFile: string;
}

export type { GeneratedKeyFiles, PublicJsonWebKey, PublishedKey };

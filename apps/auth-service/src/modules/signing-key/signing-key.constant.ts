const RSA_KEY_TYPE = 'RSA';
const JWK_SIGNATURE_USE = 'sig';
const JWKS_CACHE_CONTROL = 'public, max-age=300';

const SIGNING_KEY_DIRECTORY = 'apps/auth-service/secrets';
const SIGNING_KEY_NAME_PATTERN = /^[a-z0-9-]{1,64}$/;
const PRIVATE_KEY_SUFFIX = '.private.pem';
const PUBLIC_KEY_SUFFIX = '.public.pem';
const KEY_FILE_MODE = 0o600;

export {
  JWK_SIGNATURE_USE,
  JWKS_CACHE_CONTROL,
  KEY_FILE_MODE,
  PRIVATE_KEY_SUFFIX,
  PUBLIC_KEY_SUFFIX,
  RSA_KEY_TYPE,
  SIGNING_KEY_DIRECTORY,
  SIGNING_KEY_NAME_PATTERN,
};

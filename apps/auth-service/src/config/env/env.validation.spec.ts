import validate from './env.validation';

const validEnv = {
  NODE_ENV: 'development',

  PORT: '7000',

  SERVICE_NAME: 'auth-service',

  DATABASE_HOST: 'masr3-pgbouncer',
  DATABASE_PORT: '6432',

  POSTGRES_USER: 'auth',
  POSTGRES_PASSWORD: 'auth_user_password',
  POSTGRES_DB: 'auth_db',

  JWT_PRIVATE_KEY_FILE: 'apps/auth-service/secrets/jwt.private.pem',

  ACCESS_TOKEN_EXPIRES_IN_SECONDS: '300',
  REFRESH_TOKEN_EXPIRES_IN_SECONDS: '604800',
  SERVICE_TOKEN_EXPIRES_IN_SECONDS: '300',

  NOTIFICATION_SERVICE_CLIENT_SECRET: 'ab'.repeat(32),

  PASSWORD_RESET_TOKEN_TTL_MS: '3600000',

  THROTTLE_SHORT_TTL_MS: '1000',
  THROTTLE_SHORT_LIMIT: '3',

  THROTTLE_MEDIUM_TTL_MS: '10000',
  THROTTLE_MEDIUM_LIMIT: '20',

  THROTTLE_LONG_TTL_MS: '60000',
  THROTTLE_LONG_LIMIT: '100',

  KAFKA_BROKER: 'localhost:42000',
  KAFKA_CLIENT_ID: 'auth-service',

  REDIS_HOST: 'localhost',
  REDIS_PORT: '44000',

  OUTBOX_POLL_INTERVAL_MS: '1000',
  OUTBOX_BATCH_SIZE: '100',
  OUTBOX_RETENTION_MS: '604800000',
  OUTBOX_RELAY_LOCK_ID: '7000001',
};

describe('validate', () => {
  describe('valid configuration', () => {
    it('returns validated configuration', () => {
      const result = validate(validEnv);

      expect(result.NODE_ENV).toBe('development');

      expect(result.PORT).toBe(7000);
      expect(typeof result.PORT).toBe('number');

      expect(result.DATABASE_PORT).toBe(6432);
      expect(typeof result.DATABASE_PORT).toBe('number');

      expect(result.DATABASE_HOST).toBe('masr3-pgbouncer');

      expect(result.PASSWORD_RESET_TOKEN_TTL_MS).toBe(3600000);

      expect(result.THROTTLE_SHORT_TTL_MS).toBe(1000);
      expect(result.THROTTLE_SHORT_LIMIT).toBe(3);

      expect(result.THROTTLE_MEDIUM_TTL_MS).toBe(10000);
      expect(result.THROTTLE_MEDIUM_LIMIT).toBe(20);

      expect(result.THROTTLE_LONG_TTL_MS).toBe(60000);
      expect(result.THROTTLE_LONG_LIMIT).toBe(100);
    });

    it.each(['development', 'production', 'test'])(
      'accepts NODE_ENV=%s',
      (NODE_ENV) => {
        expect(() =>
          validate({
            ...validEnv,
            NODE_ENV,
          }),
        ).not.toThrow();
      },
    );
  });

  describe('required variables', () => {
    it.each([
      'NODE_ENV',
      'PORT',
      'SERVICE_NAME',
      'DATABASE_HOST',
      'DATABASE_PORT',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
      'JWT_PRIVATE_KEY_FILE',
      'ACCESS_TOKEN_EXPIRES_IN_SECONDS',
      'REFRESH_TOKEN_EXPIRES_IN_SECONDS',
      'SERVICE_TOKEN_EXPIRES_IN_SECONDS',
      'NOTIFICATION_SERVICE_CLIENT_SECRET',
      'PASSWORD_RESET_TOKEN_TTL_MS',
      'THROTTLE_SHORT_TTL_MS',
      'THROTTLE_SHORT_LIMIT',
      'THROTTLE_MEDIUM_TTL_MS',
      'THROTTLE_MEDIUM_LIMIT',
      'THROTTLE_LONG_TTL_MS',
      'THROTTLE_LONG_LIMIT',
      'KAFKA_BROKER',
      'KAFKA_CLIENT_ID',
      'REDIS_HOST',
      'REDIS_PORT',
      'OUTBOX_POLL_INTERVAL_MS',
      'OUTBOX_BATCH_SIZE',
      'OUTBOX_RETENTION_MS',
    ])('throws when %s is missing', (property) => {
      const config = { ...validEnv };

      delete config[property as keyof typeof config];

      expect(() => validate(config)).toThrow();
    });
  });

  describe('NODE_ENV', () => {
    it('throws for an unknown environment', () => {
      expect(() =>
        validate({
          ...validEnv,
          NODE_ENV: 'bogus',
        }),
      ).toThrow();
    });

    it('throws when NODE_ENV is empty', () => {
      expect(() =>
        validate({
          ...validEnv,
          NODE_ENV: '',
        }),
      ).toThrow();
    });
  });

  describe('PORT', () => {
    it('accepts port 1', () => {
      expect(() =>
        validate({
          ...validEnv,
          PORT: '1',
        }),
      ).not.toThrow();
    });

    it('accepts port 65535', () => {
      expect(() =>
        validate({
          ...validEnv,
          PORT: '65535',
        }),
      ).not.toThrow();
    });

    it('rejects port 0', () => {
      expect(() =>
        validate({
          ...validEnv,
          PORT: '0',
        }),
      ).toThrow();
    });

    it('rejects port above 65535', () => {
      expect(() =>
        validate({
          ...validEnv,
          PORT: '65536',
        }),
      ).toThrow();
    });
  });

  describe('DATABASE_PORT', () => {
    it('rejects an invalid database port', () => {
      expect(() =>
        validate({
          ...validEnv,
          DATABASE_PORT: '70000',
        }),
      ).toThrow();
    });
  });

  describe('token lifetimes', () => {
    it('converts "300" to the integer 300', () => {
      const result = validate(validEnv);

      expect(result.ACCESS_TOKEN_EXPIRES_IN_SECONDS).toBe(300);
      expect(result.REFRESH_TOKEN_EXPIRES_IN_SECONDS).toBe(604800);
      expect(result.SERVICE_TOKEN_EXPIRES_IN_SECONDS).toBe(300);
    });

    it.each([
      ['ACCESS_TOKEN_EXPIRES_IN_SECONDS', '300.5'],
      ['ACCESS_TOKEN_EXPIRES_IN_SECONDS', 'five minutes'],
      ['ACCESS_TOKEN_EXPIRES_IN_SECONDS', '59'],
      ['REFRESH_TOKEN_EXPIRES_IN_SECONDS', '604800.5'],
      ['REFRESH_TOKEN_EXPIRES_IN_SECONDS', '3599'],
      ['SERVICE_TOKEN_EXPIRES_IN_SECONDS', '300.5'],
      ['SERVICE_TOKEN_EXPIRES_IN_SECONDS', '59'],
    ])('rejects %s=%s', (property, value) => {
      expect(() => validate({ ...validEnv, [property]: value })).toThrow();
    });
  });

  describe('signing keys', () => {
    it('accepts an optional previous public key file', () => {
      expect(
        validate({
          ...validEnv,
          JWT_PREVIOUS_PUBLIC_KEY_FILE:
            'apps/auth-service/secrets/old.public.pem',
        }).JWT_PREVIOUS_PUBLIC_KEY_FILE,
      ).toBe('apps/auth-service/secrets/old.public.pem');
    });

    it('rejects an empty previous public key file', () => {
      expect(() =>
        validate({ ...validEnv, JWT_PREVIOUS_PUBLIC_KEY_FILE: '' }),
      ).toThrow();
    });

    it('rejects an empty private key file', () => {
      expect(() =>
        validate({ ...validEnv, JWT_PRIVATE_KEY_FILE: '' }),
      ).toThrow();
    });
  });

  describe('outbox and queue', () => {
    it.each([
      ['REDIS_PORT', '0'],
      ['REDIS_PORT', '65536'],
      ['REDIS_HOST', ''],
      ['OUTBOX_POLL_INTERVAL_MS', '0'],
      ['OUTBOX_BATCH_SIZE', '0'],
      ['OUTBOX_RETENTION_MS', 'a week'],
    ])('rejects %s=%p', (property, value) => {
      expect(() => validate({ ...validEnv, [property]: value })).toThrow();
    });
  });

  describe('NOTIFICATION_SERVICE_CLIENT_SECRET', () => {
    it.each([
      ['too short', 'ab'.repeat(31)],
      ['too long', 'ab'.repeat(33)],
      ['uppercase hex', 'AB'.repeat(32)],
      ['not hex', 'z'.repeat(64)],
    ])('rejects a secret that is %s', (_case, secret) => {
      expect(() =>
        validate({ ...validEnv, NOTIFICATION_SERVICE_CLIENT_SECRET: secret }),
      ).toThrow();
    });
  });

  describe('string variables', () => {
    it('rejects an empty database host', () => {
      expect(() =>
        validate({
          ...validEnv,
          DATABASE_HOST: '',
        }),
      ).toThrow();
    });

    it('rejects an empty postgres user', () => {
      expect(() =>
        validate({
          ...validEnv,
          POSTGRES_USER: '',
        }),
      ).toThrow();
    });

    it('rejects an empty postgres password', () => {
      expect(() =>
        validate({
          ...validEnv,
          POSTGRES_PASSWORD: '',
        }),
      ).toThrow();
    });

    it('rejects an empty postgres database name', () => {
      expect(() =>
        validate({
          ...validEnv,
          POSTGRES_DB: '',
        }),
      ).toThrow();
    });
  });

  describe('numeric values', () => {
    it('converts numeric environment variables from strings to numbers', () => {
      const result = validate(validEnv);

      expect(result.PORT).toEqual(expect.any(Number));
      expect(result.DATABASE_PORT).toEqual(expect.any(Number));
      expect(result.PASSWORD_RESET_TOKEN_TTL_MS).toEqual(expect.any(Number));
      expect(result.THROTTLE_SHORT_TTL_MS).toEqual(expect.any(Number));
      expect(result.THROTTLE_SHORT_LIMIT).toEqual(expect.any(Number));
      expect(result.THROTTLE_MEDIUM_TTL_MS).toEqual(expect.any(Number));
      expect(result.THROTTLE_MEDIUM_LIMIT).toEqual(expect.any(Number));
      expect(result.THROTTLE_LONG_TTL_MS).toEqual(expect.any(Number));
      expect(result.THROTTLE_LONG_LIMIT).toEqual(expect.any(Number));
    });

    it('rejects a non-numeric port', () => {
      expect(() =>
        validate({
          ...validEnv,
          PORT: 'not-a-number',
        }),
      ).toThrow();
    });

    it('rejects zero TTL', () => {
      expect(() =>
        validate({
          ...validEnv,
          PASSWORD_RESET_TOKEN_TTL_MS: '0',
        }),
      ).toThrow();
    });

    it('rejects zero throttle limit', () => {
      expect(() =>
        validate({
          ...validEnv,
          THROTTLE_SHORT_LIMIT: '0',
        }),
      ).toThrow();
    });
  });
});

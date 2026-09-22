import validate from './env.validation';

const validEnv = {
  NODE_ENV: 'development',

  PORT: '7000',

  DATABASE_HOST: 'masr3-pgbouncer',
  DATABASE_PORT: '6432',

  POSTGRES_USER: 'auth',
  POSTGRES_PASSWORD: 'auth_user_password',
  POSTGRES_DB: 'auth_db',

  JWT_SECRET: 'a'.repeat(32),
  JWT_EXPIRES_IN: '1d',

  PASSWORD_RESET_TOKEN_TTL_MS: '3600000',

  THROTTLE_SHORT_TTL_MS: '1000',
  THROTTLE_SHORT_LIMIT: '3',

  THROTTLE_MEDIUM_TTL_MS: '10000',
  THROTTLE_MEDIUM_LIMIT: '20',

  THROTTLE_LONG_TTL_MS: '60000',
  THROTTLE_LONG_LIMIT: '100',
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
      'DATABASE_HOST',
      'DATABASE_PORT',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
      'JWT_SECRET',
      'JWT_EXPIRES_IN',
      'PASSWORD_RESET_TOKEN_TTL_MS',
      'THROTTLE_SHORT_TTL_MS',
      'THROTTLE_SHORT_LIMIT',
      'THROTTLE_MEDIUM_TTL_MS',
      'THROTTLE_MEDIUM_LIMIT',
      'THROTTLE_LONG_TTL_MS',
      'THROTTLE_LONG_LIMIT',
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

  describe('JWT_SECRET', () => {
    it('accepts a 32-character secret', () => {
      expect(() =>
        validate({
          ...validEnv,
          JWT_SECRET: 'a'.repeat(32),
        }),
      ).not.toThrow();
    });

    it('rejects a secret shorter than 32 characters', () => {
      expect(() =>
        validate({
          ...validEnv,
          JWT_SECRET: 'a'.repeat(31),
        }),
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

    it('rejects an empty JWT expiration value', () => {
      expect(() =>
        validate({
          ...validEnv,
          JWT_EXPIRES_IN: '',
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

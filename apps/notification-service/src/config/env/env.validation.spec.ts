import validate from './env.validation';

const validEnv = {
  NODE_ENV: 'development',

  PORT: '7001',

  SERVICE_NAME: 'notification-service',

  APP_NAME: 'Masr3',

  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '41500',

  POSTGRES_USER: 'notification',
  POSTGRES_PASSWORD: 'notification_user_password',
  POSTGRES_DB: 'notification_db',

  MAIL_HOST: 'localhost',
  MAIL_PORT: '45000',
  MAIL_SECURE: 'false',
  MAIL_FROM: 'Masr3 <no-reply@masr3.local>',

  PASSWORD_RESET_URL_BASE: 'http://localhost:3000/reset-password',

  KAFKA_BROKER: 'localhost:42000',
  KAFKA_CLIENT_ID: 'notification-service',
  KAFKA_CONSUMER_GROUP_ID: 'notification-service',

  AUTH_SERVICE_URL: 'http://localhost:7000/api',
  SERVICE_CLIENT_SECRET: 'ab'.repeat(32),
};

describe('validate', () => {
  describe('valid configuration', () => {
    it('returns validated configuration', () => {
      const result = validate(validEnv);

      expect(result.NODE_ENV).toBe('development');

      expect(result.PORT).toBe(7001);
      expect(result.DATABASE_PORT).toBe(41500);
      expect(result.MAIL_PORT).toBe(45000);

      expect(result.KAFKA_CONSUMER_GROUP_ID).toBe('notification-service');
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

    it('accepts missing optional variables', () => {
      const result = validate(validEnv);

      expect(result.MAIL_USER).toBeUndefined();
      expect(result.MAIL_PASSWORD).toBeUndefined();
    });
  });

  describe('required variables', () => {
    it.each([
      'NODE_ENV',
      'PORT',
      'SERVICE_NAME',
      'APP_NAME',
      'DATABASE_HOST',
      'DATABASE_PORT',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
      'MAIL_HOST',
      'MAIL_PORT',
      'MAIL_SECURE',
      'MAIL_FROM',
      'PASSWORD_RESET_URL_BASE',
      'KAFKA_BROKER',
      'KAFKA_CLIENT_ID',
      'KAFKA_CONSUMER_GROUP_ID',
      'AUTH_SERVICE_URL',
      'SERVICE_CLIENT_SECRET',
    ])('throws when %s is missing', (property) => {
      const config = { ...validEnv };

      delete config[property as keyof typeof config];

      expect(() => validate(config)).toThrow();
    });
  });

  describe('AUTH_SERVICE_URL', () => {
    it.each([
      ['without the /api prefix', 'http://localhost:7000'],
      ['with a trailing slash', 'http://localhost:7000/api/'],
      ['without a protocol', 'localhost:7000/api'],
    ])('rejects a URL %s', (_case, AUTH_SERVICE_URL) => {
      expect(() => validate({ ...validEnv, AUTH_SERVICE_URL })).toThrow();
    });
  });

  describe('SERVICE_CLIENT_SECRET', () => {
    it.each([
      ['too short', 'ab'.repeat(31)],
      ['uppercase hex', 'AB'.repeat(32)],
      ['not hex', 'z'.repeat(64)],
    ])('rejects a secret that is %s', (_case, SERVICE_CLIENT_SECRET) => {
      expect(() => validate({ ...validEnv, SERVICE_CLIENT_SECRET })).toThrow();
    });
  });

  describe('MAIL_SECURE', () => {
    // Implicit conversion would turn the string 'false' into `true`.
    it.each([
      ['false', false],
      ['FALSE', false],
      ['true', true],
      [' true ', true],
    ])('parses %p as %p', (MAIL_SECURE, expected) => {
      expect(validate({ ...validEnv, MAIL_SECURE }).MAIL_SECURE).toBe(expected);
    });

    it('rejects a non-boolean value', () => {
      expect(() => validate({ ...validEnv, MAIL_SECURE: 'yes' })).toThrow();
    });
  });

  describe('PORT', () => {
    it('rejects port 0', () => {
      expect(() => validate({ ...validEnv, PORT: '0' })).toThrow();
    });

    it('rejects port above 65535', () => {
      expect(() => validate({ ...validEnv, PORT: '65536' })).toThrow();
    });

    it('rejects a non-numeric port', () => {
      expect(() => validate({ ...validEnv, PORT: 'not-a-number' })).toThrow();
    });
  });

  describe('PASSWORD_RESET_URL_BASE', () => {
    it('rejects a URL without a protocol', () => {
      expect(() =>
        validate({
          ...validEnv,
          PASSWORD_RESET_URL_BASE: 'localhost:3000/reset-password',
        }),
      ).toThrow();
    });
  });

  describe('string variables', () => {
    it.each([
      'APP_NAME',
      'DATABASE_HOST',
      'MAIL_HOST',
      'MAIL_FROM',
      'KAFKA_BROKER',
    ])('rejects an empty %s', (property) => {
      expect(() => validate({ ...validEnv, [property]: '' })).toThrow();
    });
  });
});

import validate from '../env.validation';

const validEnv = {
  NODE_ENV: 'development',

  PORT: '7003',

  SERVICE_NAME: 'audit-service',

  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '41500',

  POSTGRES_USER: 'audit',
  POSTGRES_PASSWORD: 'audit_user_password',
  POSTGRES_DB: 'audit_db',

  KAFKA_BROKER: 'localhost:42000',
  KAFKA_CLIENT_ID: 'audit-service',
  KAFKA_CONSUMER_GROUP_ID: 'audit-service',

  AUTH_SERVICE_URL: 'http://localhost:7000/api',
};

describe('validate', () => {
  describe('valid configuration', () => {
    it('returns validated configuration', () => {
      const result = validate(validEnv);

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe(7003);
      expect(result.DATABASE_PORT).toBe(41500);
      expect(result.POSTGRES_DB).toBe('audit_db');
      expect(result.KAFKA_CONSUMER_GROUP_ID).toBe('audit-service');
    });

    it.each(['development', 'production', 'test'])(
      'accepts NODE_ENV=%s',
      (NODE_ENV) => {
        expect(() => validate({ ...validEnv, NODE_ENV })).not.toThrow();
      },
    );
  });

  describe('required variables', () => {
    it.each(Object.keys(validEnv))('throws when %s is missing', (property) => {
      const config = { ...validEnv };

      delete config[property as keyof typeof config];

      expect(() => validate(config)).toThrow();
    });
  });

  describe.each(['PORT', 'DATABASE_PORT'])('%s', (property) => {
    it.each(['0', '65536', 'not-a-number'])('rejects %p', (value) => {
      expect(() => validate({ ...validEnv, [property]: value })).toThrow();
    });
  });

  describe('string variables', () => {
    it.each([
      'SERVICE_NAME',
      'DATABASE_HOST',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
      'KAFKA_BROKER',
      'KAFKA_CLIENT_ID',
      'KAFKA_CONSUMER_GROUP_ID',
    ])('rejects an empty %s', (property) => {
      expect(() => validate({ ...validEnv, [property]: '' })).toThrow();
    });
  });

  describe('AUTH_SERVICE_URL', () => {
    it.each([
      ['without the /api prefix', 'http://localhost:7000'],
      ['with a trailing slash', 'http://localhost:7000/api/'],
      ['without a protocol', 'localhost:7000/api'],
      ['that is not a URL', 'auth-service'],
    ])('rejects a URL %s', (_case, AUTH_SERVICE_URL) => {
      expect(() => validate({ ...validEnv, AUTH_SERVICE_URL })).toThrow();
    });
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validate({ ...validEnv, NODE_ENV: 'staging' })).toThrow();
  });
});

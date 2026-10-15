import validate from '../env.validation';

const validEnv = {
  NODE_ENV: 'development',

  PORT: '7004',

  SERVICE_NAME: 'vehicle-service',

  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '41500',

  POSTGRES_USER: 'vehicle',
  POSTGRES_PASSWORD: 'vehicle_user_password',
  POSTGRES_DB: 'vehicle_db',

  REDIS_HOST: 'localhost',
  REDIS_PORT: '44000',

  KAFKA_BROKER: 'localhost:42000',
  KAFKA_CLIENT_ID: 'vehicle-service',
  KAFKA_CONSUMER_GROUP_ID: 'vehicle-service',

  OUTBOX_POLL_INTERVAL_MS: '1000',
  OUTBOX_BATCH_SIZE: '100',
  OUTBOX_RETENTION_MS: '604800000',
  OUTBOX_RELAY_LOCK_ID: '7004001',

  AUTH_SERVICE_URL: 'http://localhost:7000/api',
};

describe('validate', () => {
  describe('valid configuration', () => {
    it('returns validated configuration', () => {
      const result = validate(validEnv);

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe(7004);
      expect(result.DATABASE_PORT).toBe(41500);
      expect(result.POSTGRES_DB).toBe('vehicle_db');
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

  describe.each(['PORT', 'REDIS_PORT'])('%s', (property) => {
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
      'REDIS_HOST',
      'KAFKA_BROKER',
      'KAFKA_CLIENT_ID',
      'KAFKA_CONSUMER_GROUP_ID',
    ])('rejects an empty %s', (property) => {
      expect(() => validate({ ...validEnv, [property]: '' })).toThrow();
    });
  });

  describe.each([
    'OUTBOX_POLL_INTERVAL_MS',
    'OUTBOX_BATCH_SIZE',
    'OUTBOX_RETENTION_MS',
    'OUTBOX_RELAY_LOCK_ID',
  ])('%s', (property) => {
    it.each(['0', '-1', 'soon'])('rejects %p', (value) => {
      expect(() => validate({ ...validEnv, [property]: value })).toThrow();
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

import validate from './env.validation';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '7000',
  DATABASE_HOST: 'masr3-pgbouncer',
  DATABASE_PORT: '6432',
  POSTGRES_USER: 'auth',
  POSTGRES_PASSWORD: 'authpass',
  POSTGRES_DB: 'auth_db',
  JWT_SECRET: 'a'.repeat(32),
  JWT_EXPIRES_IN: '1d',
  KAFKA_BROKER: 'masr3-kafka:9092',
  KAFKA_CLIENT_ID: 'auth-service',
  PASSWORD_RESET_TOKEN_TTL_MS: '3600000',
  KAFKA_CONSUMER_MAX_ATTEMPTS: '3',
  THROTTLE_SHORT_TTL_MS: '1000',
  THROTTLE_SHORT_LIMIT: '3',
  THROTTLE_MEDIUM_TTL_MS: '10000',
  THROTTLE_MEDIUM_LIMIT: '20',
  THROTTLE_LONG_TTL_MS: '60000',
  THROTTLE_LONG_LIMIT: '100',
};

describe('validate', () => {
  it('returns a validated config for valid env vars', () => {
    const result = validate(validEnv);
    expect(result.PORT).toBe(7000);
    expect(result.DATABASE_PORT).toBe(6432);
    expect(result.PASSWORD_RESET_TOKEN_TTL_MS).toBe(3600000);
    expect(result.KAFKA_CLIENT_ID).toBe('auth-service');
    expect(result.KAFKA_CONSUMER_MAX_ATTEMPTS).toBe(3);
    expect(result.THROTTLE_SHORT_TTL_MS).toBe(1000);
    expect(result.THROTTLE_LONG_LIMIT).toBe(100);
  });

  it('throws when a required var is missing', () => {
    const { JWT_SECRET, ...rest } = validEnv;
    expect(() => validate(rest)).toThrow();
  });

  it('throws when NODE_ENV is not a known value', () => {
    expect(() => validate({ ...validEnv, NODE_ENV: 'bogus' })).toThrow();
  });

  it('throws when JWT_SECRET is too short', () => {
    expect(() => validate({ ...validEnv, JWT_SECRET: 'short' })).toThrow();
  });
});

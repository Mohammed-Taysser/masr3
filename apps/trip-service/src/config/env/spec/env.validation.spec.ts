import validate from '../env.validation';

const validEnv = {
  NODE_ENV: 'development',

  PORT: '7002',

  SERVICE_NAME: 'trip-service',

  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '41500',

  POSTGRES_USER: 'trip',
  POSTGRES_PASSWORD: 'trip_user_password',
  POSTGRES_DB: 'trip_db',

  TRIP_REQUEST_TTL_MS: '600000',
};

describe('validate', () => {
  describe('valid configuration', () => {
    it('returns validated configuration', () => {
      const result = validate(validEnv);

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe(7002);
      expect(result.DATABASE_PORT).toBe(41500);
      expect(result.POSTGRES_DB).toBe('trip_db');
      expect(result.TRIP_REQUEST_TTL_MS).toBe(600000);
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

  describe('PORT', () => {
    it.each(['0', '65536', 'not-a-number'])('rejects %p', (PORT) => {
      expect(() => validate({ ...validEnv, PORT })).toThrow();
    });
  });

  describe('string variables', () => {
    it.each([
      'SERVICE_NAME',
      'DATABASE_HOST',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
    ])('rejects an empty %s', (property) => {
      expect(() => validate({ ...validEnv, [property]: '' })).toThrow();
    });
  });

  describe('TRIP_REQUEST_TTL_MS', () => {
    it.each(['0', '-1', 'ten-minutes'])('rejects %p', (TRIP_REQUEST_TTL_MS) => {
      expect(() => validate({ ...validEnv, TRIP_REQUEST_TTL_MS })).toThrow();
    });
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validate({ ...validEnv, NODE_ENV: 'staging' })).toThrow();
  });
});

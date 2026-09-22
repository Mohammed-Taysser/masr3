import { validate } from 'class-validator';
import RegisterDto from '../../dto/register.dto';

describe('RegisterDto', () => {
  const createDto = (overrides: Partial<RegisterDto> = {}): RegisterDto => {
    const dto = new RegisterDto();

    Object.assign(dto, {
      email: 'nour.hassan@masr3.local',
      password: 'ChangeMe123!',
      firstName: 'Nour',
      lastName: 'Hassan',
      ...overrides,
    });

    return dto;
  };

  it('accepts a valid DTO', async () => {
    const errors = await validate(createDto());

    expect(errors).toHaveLength(0);
  });

  describe('email', () => {
    it('accepts a valid email', async () => {
      const errors = await validate(
        createDto({
          email: 'john@example.com',
        }),
      );

      expect(errors).toHaveLength(0);
    });

    it('rejects an invalid email', async () => {
      const errors = await validate(
        createDto({
          email: 'invalid-email',
        }),
      );

      expect(errors.some((error) => error.property === 'email')).toBe(true);
    });

    it('rejects a non-string email', async () => {
      const errors = await validate(
        createDto({
          email: 123 as unknown as string,
        }),
      );

      expect(errors.some((error) => error.property === 'email')).toBe(true);
    });
  });

  describe('password', () => {
    it('accepts a password with exactly 8 characters', async () => {
      const errors = await validate(
        createDto({
          password: '12345678',
        }),
      );

      expect(errors).toHaveLength(0);
    });

    it('rejects a password shorter than 8 characters', async () => {
      const errors = await validate(
        createDto({
          password: '1234567',
        }),
      );

      expect(errors.some((error) => error.property === 'password')).toBe(
        true,
      );
    });

    it('rejects a non-string password', async () => {
      const errors = await validate(
        createDto({
          password: 12345678 as unknown as string,
        }),
      );

      expect(errors.some((error) => error.property === 'password')).toBe(
        true,
      );
    });
  });

  describe('firstName', () => {
    it('accepts a string', async () => {
      const errors = await validate(
        createDto({
          firstName: 'Nour',
        }),
      );

      expect(errors).toHaveLength(0);
    });

    it('rejects a non-string value', async () => {
      const errors = await validate(
        createDto({
          firstName: 123 as unknown as string,
        }),
      );

      expect(errors.some((error) => error.property === 'firstName')).toBe(
        true,
      );
    });
  });

  describe('lastName', () => {
    it('accepts a string', async () => {
      const errors = await validate(
        createDto({
          lastName: 'Hassan',
        }),
      );

      expect(errors).toHaveLength(0);
    });

    it('rejects a non-string value', async () => {
      const errors = await validate(
        createDto({
          lastName: 123 as unknown as string,
        }),
      );

      expect(errors.some((error) => error.property === 'lastName')).toBe(
        true,
      );
    });
  });
});

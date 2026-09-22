import { validate } from 'class-validator';
import LoginDto from '../../dto/login.dto';

describe('LoginDto', () => {
  const createDto = (overrides: Partial<LoginDto> = {}): LoginDto => {
    const dto = new LoginDto();

    Object.assign(dto, {
      email: 'customer@masr3.local',
      password: 'ChangeMe123!',
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
    it('accepts any non-empty string', async () => {
      const errors = await validate(
        createDto({
          password: 'short',
        }),
      );

      expect(errors).toHaveLength(0);
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

    it('rejects an undefined password', async () => {
      const dto = createDto();
      delete (dto as Partial<LoginDto>).password;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'password')).toBe(
        true,
      );
    });
  });
});

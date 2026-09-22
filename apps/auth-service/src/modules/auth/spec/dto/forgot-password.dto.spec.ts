import { validate } from 'class-validator';
import ForgotPasswordDto from '../../dto/forgot-password.dto';

describe('ForgotPasswordDto', () => {
  const createDto = (
    overrides: Partial<ForgotPasswordDto> = {},
  ): ForgotPasswordDto => {
    const dto = new ForgotPasswordDto();

    Object.assign(dto, {
      email: 'customer@masr3.local',
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

    it('rejects an undefined email', async () => {
      const dto = createDto();
      delete (dto as Partial<ForgotPasswordDto>).email;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'email')).toBe(true);
    });
  });
});

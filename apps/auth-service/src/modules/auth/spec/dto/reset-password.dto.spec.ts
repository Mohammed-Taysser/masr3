import { validate } from 'class-validator';
import ResetPasswordDto from '../../dto/reset-password.dto';

describe('ResetPasswordDto', () => {
  const createDto = (
    overrides: Partial<ResetPasswordDto> = {},
  ): ResetPasswordDto => {
    const dto = new ResetPasswordDto();

    Object.assign(dto, {
      token: '3f9a1c8e7b2d4f60a5e1c9b3d7f20486',
      newPassword: 'EvenBetter456!',
      ...overrides,
    });

    return dto;
  };

  it('accepts a valid DTO', async () => {
    const errors = await validate(createDto());

    expect(errors).toHaveLength(0);
  });

  describe('token', () => {
    it('accepts any non-empty string', async () => {
      const errors = await validate(
        createDto({
          token: 'raw-reset-token',
        }),
      );

      expect(errors).toHaveLength(0);
    });

    it('rejects a non-string value', async () => {
      const errors = await validate(
        createDto({
          token: 12345678 as unknown as string,
        }),
      );

      expect(errors.some((error) => error.property === 'token')).toBe(true);
    });

    it('rejects an undefined token', async () => {
      const dto = createDto();
      delete (dto as Partial<ResetPasswordDto>).token;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'token')).toBe(true);
    });
  });

  describe('newPassword', () => {
    it('accepts a password with exactly 8 characters', async () => {
      const errors = await validate(
        createDto({
          newPassword: '12345678',
        }),
      );

      expect(errors).toHaveLength(0);
    });

    it('rejects a password shorter than 8 characters', async () => {
      const errors = await validate(
        createDto({
          newPassword: '1234567',
        }),
      );

      expect(errors.some((error) => error.property === 'newPassword')).toBe(
        true,
      );
    });

    it('rejects a non-string value', async () => {
      const errors = await validate(
        createDto({
          newPassword: 12345678 as unknown as string,
        }),
      );

      expect(errors.some((error) => error.property === 'newPassword')).toBe(
        true,
      );
    });
  });
});

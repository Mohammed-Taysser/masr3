import { validate } from 'class-validator';
import ChangePasswordDto from '../../dto/change-password.dto';

describe('ChangePasswordDto', () => {
  const createDto = (
    overrides: Partial<ChangePasswordDto> = {},
  ): ChangePasswordDto => {
    const dto = new ChangePasswordDto();

    Object.assign(dto, {
      currentPassword: 'ChangeMe123!',
      newPassword: 'EvenBetter456!',
      ...overrides,
    });

    return dto;
  };

  it('accepts a valid DTO', async () => {
    const errors = await validate(createDto());

    expect(errors).toHaveLength(0);
  });

  describe('currentPassword', () => {
    it('accepts any non-empty string', async () => {
      const errors = await validate(
        createDto({
          currentPassword: 'short',
        }),
      );

      expect(errors).toHaveLength(0);
    });

    it('rejects a non-string value', async () => {
      const errors = await validate(
        createDto({
          currentPassword: 12345678 as unknown as string,
        }),
      );

      expect(errors.some((error) => error.property === 'currentPassword')).toBe(
        true,
      );
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

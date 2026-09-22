import { validate } from 'class-validator';
import CreateUserDto from '../../dto/create-user.dto';
import { UserRoleEnum } from '../../users.enum';

describe('CreateUserDto', () => {
  const createDto = (overrides: Partial<CreateUserDto> = {}): CreateUserDto => {
    const dto = new CreateUserDto();

    Object.assign(dto, {
      email: 'nour.hassan@masr3.local',
      password: 'ChangeMe123!',
      firstName: 'Nour',
      lastName: 'Hassan',
      role: UserRoleEnum.CUSTOMER,
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

      expect(errors.some((error) => error.property === 'password')).toBe(true);
    });

    it('rejects a non-string password', async () => {
      const errors = await validate(
        createDto({
          password: 12345678 as unknown as string,
        }),
      );

      expect(errors.some((error) => error.property === 'password')).toBe(true);
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

      expect(errors.some((error) => error.property === 'firstName')).toBe(true);
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

      expect(errors.some((error) => error.property === 'lastName')).toBe(true);
    });
  });

  describe('role', () => {
    it.each(Object.values(UserRoleEnum))(
      'accepts %s',
      async (role: UserRoleEnum) => {
        const errors = await validate(
          createDto({
            role,
          }),
        );

        expect(errors).toHaveLength(0);
      },
    );

    it('rejects an invalid role', async () => {
      const errors = await validate(
        createDto({
          role: 'INVALID_ROLE' as UserRoleEnum,
        }),
      );

      expect(errors.some((error) => error.property === 'role')).toBe(true);
    });

    it('allows role to be omitted', async () => {
      const dto = createDto();
      delete dto.role;

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });
});

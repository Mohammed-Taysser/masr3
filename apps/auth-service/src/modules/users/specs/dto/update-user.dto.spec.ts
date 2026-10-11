import { validate } from 'class-validator';
import UpdateUserDto from '../../dto/update-user.dto';
import { UserRoleEnum } from '@masr3/libs';

describe('UpdateUserDto', () => {
  it('accepts an empty DTO', async () => {
    const dto = new UpdateUserDto();

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a first name update', async () => {
    const dto = new UpdateUserDto();

    dto.firstName = 'Updated';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a last name update', async () => {
    const dto = new UpdateUserDto();

    dto.lastName = 'Updated';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts an email update', async () => {
    const dto = new UpdateUserDto();

    dto.email = 'updated@example.com';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a role update', async () => {
    const dto = new UpdateUserDto();

    dto.role = UserRoleEnum.DRIVER;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const dto = new UpdateUserDto();

    dto.email = 'invalid-email';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('rejects an invalid role', async () => {
    const dto = new UpdateUserDto();

    dto.role = 'INVALID_ROLE' as UserRoleEnum;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'role')).toBe(true);
  });

  it('does not expose password as an update property', () => {
    const dto = new UpdateUserDto();

    expect('password' in dto).toBe(false);
  });

  it('does not validate password as part of the DTO', async () => {
    const dto = new UpdateUserDto();

    Object.assign(dto, {
      password: 'short',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});

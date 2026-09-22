import { validate } from 'class-validator';
import UpdateUserStatusDto from '../../dto/update-user-status.dto';

describe('UpdateUserStatusDto', () => {
  it('accepts true', async () => {
    const dto = new UpdateUserStatusDto();

    dto.isActive = true;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts false', async () => {
    const dto = new UpdateUserStatusDto();

    dto.isActive = false;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a string', async () => {
    const dto = new UpdateUserStatusDto();

    dto.isActive = 'true' as unknown as boolean;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'isActive')).toBe(true);
  });

  it('rejects a number', async () => {
    const dto = new UpdateUserStatusDto();

    dto.isActive = 1 as unknown as boolean;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'isActive')).toBe(true);
  });

  it('rejects an undefined value', async () => {
    const dto = new UpdateUserStatusDto();

    dto.isActive = undefined as unknown as boolean;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'isActive')).toBe(true);
  });

  it('rejects a null value', async () => {
    const dto = new UpdateUserStatusDto();

    dto.isActive = null as unknown as boolean;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'isActive')).toBe(true);
  });
});

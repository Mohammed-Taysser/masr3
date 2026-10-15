import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import ListUsersQueryDto from '../../dto/list-users-query.dto';
import { UserRoleEnum } from '@masr3/libs/auth';

import { SortOrder, UserSortBy } from '../../users.enum';

describe('ListUsersQueryDto', () => {
  const createDto = (
    input: Record<string, unknown> = {},
  ): ListUsersQueryDto => {
    return plainToInstance(ListUsersQueryDto, input);
  };

  describe('defaults', () => {
    it('uses page 1 by default', () => {
      const dto = new ListUsersQueryDto();

      expect(dto.page).toBe(1);
    });

    it('uses limit 20 by default', () => {
      const dto = new ListUsersQueryDto();

      expect(dto.limit).toBe(20);
    });

    it('uses CREATED_AT by default', () => {
      const dto = new ListUsersQueryDto();

      expect(dto.sortBy).toBe(UserSortBy.CREATED_AT);
    });

    it('uses DESC by default', () => {
      const dto = new ListUsersQueryDto();

      expect(dto.sortOrder).toBe(SortOrder.DESC);
    });

    it('has no default search', () => {
      const dto = new ListUsersQueryDto();

      expect(dto.search).toBeUndefined();
    });

    it('has no default role', () => {
      const dto = new ListUsersQueryDto();

      expect(dto.role).toBeUndefined();
    });

    it('has no default active status', () => {
      const dto = new ListUsersQueryDto();

      expect(dto.isActive).toBeUndefined();
    });
  });

  describe('search', () => {
    it('accepts a string', async () => {
      const dto = createDto({
        search: 'john',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.search).toBe('john');
    });

    it('rejects a non-string value', async () => {
      const dto = createDto({
        search: 123,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'search')).toBe(true);
    });

    it('allows search to be omitted', async () => {
      const dto = createDto();

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('role', () => {
    it.each(Object.values(UserRoleEnum))(
      'accepts %s',
      async (role: UserRoleEnum) => {
        const dto = createDto({
          role,
        });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
      },
    );

    it('rejects an invalid role', async () => {
      const dto = createDto({
        role: 'INVALID_ROLE',
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'role')).toBe(true);
    });
  });

  describe('isActive', () => {
    it('accepts true', async () => {
      const dto = createDto({
        isActive: true,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.isActive).toBe(true);
    });

    it('accepts false', async () => {
      const dto = createDto({
        isActive: false,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.isActive).toBe(false);
    });

    it('parses the query string "true"', async () => {
      const dto = createDto({
        isActive: 'true',
      });

      expect(dto.isActive).toBe(true);

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('parses the query string "false"', async () => {
      const dto = createDto({
        isActive: 'false',
      });

      expect(dto.isActive).toBe(false);

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('rejects a non-boolean value', async () => {
      const dto = createDto({
        isActive: {},
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'isActive')).toBe(true);
    });
  });

  describe('page', () => {
    it('accepts a valid page', async () => {
      const dto = createDto({
        page: 2,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
    });

    it('transforms a string into a number', async () => {
      const dto = createDto({
        page: '5',
      });

      expect(dto.page).toBe(5);
      expect(typeof dto.page).toBe('number');

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('rejects page 0', async () => {
      const dto = createDto({
        page: 0,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'page')).toBe(true);
    });

    it('rejects a negative page', async () => {
      const dto = createDto({
        page: -1,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'page')).toBe(true);
    });

    it('rejects a non-integer page', async () => {
      const dto = createDto({
        page: 1.5,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'page')).toBe(true);
    });

    it('rejects a non-numeric page', async () => {
      const dto = createDto({
        page: 'abc',
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'page')).toBe(true);
    });
  });

  describe('limit', () => {
    it('accepts the minimum limit', async () => {
      const dto = createDto({
        limit: 1,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('accepts the maximum limit', async () => {
      const dto = createDto({
        limit: 1000,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('transforms a string into a number', async () => {
      const dto = createDto({
        limit: '25',
      });

      expect(dto.limit).toBe(25);
      expect(typeof dto.limit).toBe('number');

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('rejects limit 0', async () => {
      const dto = createDto({
        limit: 0,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'limit')).toBe(true);
    });

    it('rejects a negative limit', async () => {
      const dto = createDto({
        limit: -1,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'limit')).toBe(true);
    });

    it('rejects a limit greater than 1000', async () => {
      const dto = createDto({
        limit: 1001,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'limit')).toBe(true);
    });

    it('rejects a non-integer limit', async () => {
      const dto = createDto({
        limit: 10.5,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'limit')).toBe(true);
    });

    it('rejects a non-numeric limit', async () => {
      const dto = createDto({
        limit: 'abc',
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'limit')).toBe(true);
    });
  });

  describe('sortBy', () => {
    it.each(Object.values(UserSortBy))(
      'accepts %s',
      async (sortBy: UserSortBy) => {
        const dto = createDto({
          sortBy,
        });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
      },
    );

    it('rejects an invalid sort field', async () => {
      const dto = createDto({
        sortBy: 'invalid',
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'sortBy')).toBe(true);
    });
  });

  describe('sortOrder', () => {
    it.each(Object.values(SortOrder))(
      'accepts %s',
      async (sortOrder: SortOrder) => {
        const dto = createDto({
          sortOrder,
        });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
      },
    );

    it('rejects an invalid sort order', async () => {
      const dto = createDto({
        sortOrder: 'INVALID',
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'sortOrder')).toBe(true);
    });
  });

  it('accepts a complete valid query', async () => {
    const dto = createDto({
      search: 'john',
      role: UserRoleEnum.CUSTOMER,
      isActive: true,
      page: 2,
      limit: 50,
      sortBy: UserSortBy.EMAIL,
      sortOrder: SortOrder.ASC,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto).toMatchObject({
      search: 'john',
      role: UserRoleEnum.CUSTOMER,
      isActive: true,
      page: 2,
      limit: 50,
      sortBy: UserSortBy.EMAIL,
      sortOrder: SortOrder.ASC,
    });
  });
});

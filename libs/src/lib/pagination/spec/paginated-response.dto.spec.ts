import { Expose, instanceToPlain, plainToInstance } from 'class-transformer';

import { PaginatedResponseDto } from '../paginated-response.dto';

class ItemResponseDto {
  @Expose()
  id!: number;
}

class PaginatedItemsResponseDto extends PaginatedResponseDto(ItemResponseDto) {}

describe('PaginatedResponseDto', () => {
  it('exposes items and meta and strips everything else', () => {
    const dto = plainToInstance(PaginatedItemsResponseDto, {
      items: [{ id: 1, secret: 'x' }],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        extra: true,
      },
      extra: true,
    });

    expect(instanceToPlain(dto, { excludeExtraneousValues: true })).toEqual({
      items: [{ id: 1 }],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  });

  it('turns items into instances of the item type', () => {
    const dto = plainToInstance(PaginatedItemsResponseDto, {
      items: [{ id: 1 }],
    });

    expect(dto.items[0]).toBeInstanceOf(ItemResponseDto);
  });
});

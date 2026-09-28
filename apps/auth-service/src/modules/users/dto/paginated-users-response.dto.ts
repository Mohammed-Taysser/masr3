import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import UserResponseDto from './user-response.dto';

class PaginationMetaDto {
  @Expose()
  @ApiProperty({ example: 1, description: 'Current page number, 1-based.' })
  page: number;

  @Expose()
  @ApiProperty({ example: 20, description: 'Number of users per page.' })
  limit: number;

  @Expose()
  @ApiProperty({ example: 42, description: 'Total users matching the query.' })
  total: number;

  @Expose()
  @ApiProperty({ example: 3, description: 'Total number of pages.' })
  totalPages: number;

  @Expose()
  @ApiProperty({ example: true })
  hasNextPage: boolean;

  @Expose()
  @ApiProperty({ example: false })
  hasPreviousPage: boolean;
}

class PaginatedUsersResponseDto {
  @Expose()
  @Type(() => UserResponseDto)
  @ApiProperty({
    type: [UserResponseDto],
    description: 'Users on the current page, without password data.',
  })
  items: UserResponseDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export default PaginatedUsersResponseDto;
export { PaginationMetaDto };

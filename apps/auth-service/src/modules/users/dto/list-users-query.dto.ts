import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRoleEnum } from '@masr3/libs/auth';
import { PaginationQueryDto } from '@masr3/libs/pagination';

import { SortOrder, UserSortBy } from '../users.enum';

class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '',
    description: 'Search by first name, last name, or email.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: UserRoleEnum,
  })
  @IsOptional()
  @IsEnum(UserRoleEnum)
  role?: UserRoleEnum;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @Transform((params) => {
    if (params.value === 'true' || params.value === true) return true;
    if (params.value === 'false' || params.value === false) return false;

    return params.value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: UserSortBy,
    default: UserSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(UserSortBy)
  sortBy = UserSortBy.CREATED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder = SortOrder.DESC;
}

export default ListUsersQueryDto;

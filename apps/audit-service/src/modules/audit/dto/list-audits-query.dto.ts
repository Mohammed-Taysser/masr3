import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
  Min,
} from 'class-validator';

import { UserRoleEnum } from '@masr3/libs/auth';
import {
  AuditActionEnum,
  AuditActorTypeEnum,
  AuditEntityTypeEnum,
} from '@masr3/libs/kafka';
import { PaginationQueryDto } from '@masr3/libs/pagination';

class ListAuditsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'trip-service',
    description: 'Only entries produced by this service (its SERVICE_NAME).',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  service?: string;

  @ApiPropertyOptional({
    enum: AuditActionEnum,
    description: 'Only this action.',
  })
  @IsOptional()
  @IsEnum(AuditActionEnum)
  action?: AuditActionEnum;

  @ApiPropertyOptional({
    enum: AuditEntityTypeEnum,
    description: 'Only entries about this kind of entity.',
  })
  @IsOptional()
  @IsEnum(AuditEntityTypeEnum)
  entityType?: AuditEntityTypeEnum;

  @ApiPropertyOptional({
    type: Number,
    example: 42,
    description:
      'Only entries about this entity id. Combine with entityType for one entity history.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entityId?: number;

  @ApiPropertyOptional({
    enum: AuditActorTypeEnum,
    description: 'Only entries made by this kind of actor.',
  })
  @IsOptional()
  @IsEnum(AuditActorTypeEnum)
  actorType?: AuditActorTypeEnum;

  @ApiPropertyOptional({
    type: Number,
    example: 7,
    description: 'Only entries made by this user.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  actorId?: number;

  @ApiPropertyOptional({
    enum: UserRoleEnum,
    description: 'Only entries made by a user with this role.',
  })
  @IsOptional()
  @IsEnum(UserRoleEnum)
  actorRole?: UserRoleEnum;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-10-01T00:00:00Z',
    description: 'Only entries that occurred at or after this moment.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredFrom?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-10-31T23:59:59Z',
    description: 'Only entries that occurred at or before this moment.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredTo?: string;
}

export default ListAuditsQueryDto;

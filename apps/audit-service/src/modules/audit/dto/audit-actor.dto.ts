import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { AuditActor, AuditActorTypeEnum, UserRoleEnum } from '@masr3/libs';

import { POSTGRES_INT_MAX } from '../audit.constant';

class AuditActorDto implements AuditActor {
  @IsString()
  @IsNotEmpty()
  type: AuditActorTypeEnum;

  // Null unless the actor is a signed-in user.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(POSTGRES_INT_MAX)
  id: number | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  role: UserRoleEnum | null;
}

export default AuditActorDto;

import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { UserRoleEnum } from '@masr3/libs/auth';
import { AuditActor, AuditActorTypeEnum } from '@masr3/libs/kafka';

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

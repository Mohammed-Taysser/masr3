import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

import { AuditEntityReference, AuditEntityTypeEnum } from '@masr3/libs/kafka';

import { POSTGRES_INT_MAX } from '../audit.constant';

class AuditEntityReferenceDto implements AuditEntityReference {
  // A string, not @IsEnum: a type a producer adds before this service is
  // redeployed must still be recorded, not skipped.
  @IsString()
  @IsNotEmpty()
  type: AuditEntityTypeEnum;

  @IsInt()
  @Min(1)
  @Max(POSTGRES_INT_MAX)
  id: number;
}

export default AuditEntityReferenceDto;

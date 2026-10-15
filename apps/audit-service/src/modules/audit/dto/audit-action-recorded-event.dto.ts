import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  AuditActionEnum,
  AuditActionRecordedEvent,
  AuditChanges,
} from '@masr3/libs/kafka';

import AuditActorDto from './audit-actor.dto';
import AuditEntityReferenceDto from './audit-entity-reference.dto';

// Validates an audit.action-recorded message before it is stored. Anything it
// rejects can never be inserted, so the consumer skips it instead of retrying
// it forever. Implementing the contract keeps the two in step at compile time.
class AuditActionRecordedEventDto implements AuditActionRecordedEvent {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsISO8601({ strict: true })
  occurredAt: string;

  @IsInt()
  @Min(1)
  schemaVersion: number;

  @IsString()
  @IsNotEmpty()
  service: string;

  // A string, not @IsEnum: an action a producer adds before this service is
  // redeployed must still be recorded, not skipped.
  @IsString()
  @IsNotEmpty()
  action: AuditActionEnum;

  @IsDefined()
  @ValidateNested()
  @Type(() => AuditEntityReferenceDto)
  entity: AuditEntityReferenceDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => AuditActorDto)
  actor: AuditActorDto;

  @IsOptional()
  @IsObject()
  changes: AuditChanges | null;

  @IsOptional()
  @IsObject()
  metadata: Record<string, unknown> | null;
}

export default AuditActionRecordedEventDto;

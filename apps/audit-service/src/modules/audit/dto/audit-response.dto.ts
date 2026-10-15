import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { UserRoleEnum } from '@masr3/libs/auth';
import {
  AuditActionEnum,
  AuditActorTypeEnum,
  AuditChanges,
  AuditEntityTypeEnum,
} from '@masr3/libs/kafka';

class AuditResponseDto {
  @Expose()
  @ApiProperty({ example: 12 })
  id: number;

  @Expose()
  @ApiProperty({
    example: '0b6f3c1e-2a4d-4e8f-9c1a-5d7e8f9a0b1c',
    description: 'The Kafka event this entry was recorded from.',
  })
  eventId: string;

  @Expose()
  @ApiProperty({ example: 1, description: 'Version of the event envelope.' })
  schemaVersion: number;

  @Expose()
  @ApiProperty({
    example: 'trip-service',
    description: 'SERVICE_NAME of the producer.',
  })
  service: string;

  @Expose()
  @ApiProperty({ enum: AuditActionEnum })
  action: AuditActionEnum;

  @Expose()
  @ApiProperty({ enum: AuditEntityTypeEnum })
  entityType: AuditEntityTypeEnum;

  @Expose()
  @ApiProperty({ example: 42 })
  entityId: number;

  @Expose()
  @ApiProperty({ enum: AuditActorTypeEnum })
  actorType: AuditActorTypeEnum;

  @Expose()
  @ApiProperty({
    type: Number,
    example: 7,
    nullable: true,
    description: 'Null unless actorType is USER.',
  })
  actorId: number | null;

  @Expose()
  @ApiProperty({
    enum: UserRoleEnum,
    nullable: true,
    description: 'Role of the acting user. Null unless actorType is USER.',
  })
  actorRole: UserRoleEnum | null;

  @Expose()
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { status: { old: 'REQUESTED', new: 'ACCEPTED' } },
    description: 'Changed fields, each with its old and new value.',
  })
  changes: AuditChanges | null;

  @Expose()
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { reason: 'Driver did not arrive' },
    description: 'Context the producer attached to the action.',
  })
  metadata: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When the producer made the change.',
  })
  occurredAt: Date;

  @Expose()
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When audit-service recorded it.',
  })
  createdAt: Date;
}

export default AuditResponseDto;

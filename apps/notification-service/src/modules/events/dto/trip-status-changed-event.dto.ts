import {
  IsInt,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import {
  KafkaEventDto,
  TripActorEnum,
  TripStatusChangedEvent,
  TripStatusEnum,
  TripTypeEnum,
} from '@masr3/libs/kafka';

// Statuses, type and actor are checked as strings, not @IsEnum: a value
// trip-service adds before this service is redeployed must reach the handler,
// which ignores what it doesn't know, instead of being skipped as malformed.
class TripStatusChangedEventDto
  extends KafkaEventDto
  implements TripStatusChangedEvent
{
  @IsInt()
  @Min(1)
  tripId: number;

  @IsString()
  @IsNotEmpty()
  type: TripTypeEnum;

  @IsInt()
  @Min(1)
  customerId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  driverId: number | null;

  @IsOptional()
  @IsString()
  fromStatus: TripStatusEnum | null;

  @IsString()
  @IsNotEmpty()
  toStatus: TripStatusEnum;

  @IsString()
  @IsNotEmpty()
  actor: TripActorEnum;

  @IsOptional()
  @IsInt()
  @Min(1)
  actorId: number | null;

  @IsOptional()
  @IsString()
  reason: string | null;

  @IsString()
  pickupAddress: string;

  @IsString()
  dropoffAddress: string;

  // The templates format these with the money helper.
  @IsNumber()
  proposedFare: number;

  @IsOptional()
  @IsNumber()
  agreedFare: number | null;

  @IsISO4217CurrencyCode()
  currency: string;
}

export default TripStatusChangedEventDto;

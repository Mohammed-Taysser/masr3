import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { TripTypeEnum } from '@masr3/libs/kafka';
import { IsMoney } from '@masr3/libs/money';

const isParcel = (dto: CreateTripDto) => dto.type === TripTypeEnum.PARCEL;

class CreateTripDto {
  @ApiProperty({ enum: TripTypeEnum, example: TripTypeEnum.RIDE })
  @IsEnum(TripTypeEnum)
  type: TripTypeEnum;

  @ApiProperty({ example: 30.04442 })
  @IsLatitude()
  pickupLatitude: number;

  @ApiProperty({ example: 31.235712 })
  @IsLongitude()
  pickupLongitude: number;

  @ApiProperty({ example: 'Tahrir Square, Cairo' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  pickupAddress: string;

  @ApiProperty({ example: 30.0131 })
  @IsLatitude()
  dropoffLatitude: number;

  @ApiProperty({ example: 31.2089 })
  @IsLongitude()
  dropoffLongitude: number;

  @ApiProperty({ example: 'Giza Pyramids' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  dropoffAddress: string;

  @ApiProperty({
    example: 85.5,
    description: 'The fare the customer proposes, in EGP (2 decimals).',
  })
  @IsMoney()
  proposedFare: number;

  @ApiPropertyOptional({
    example: 'Mona Adel',
    description: 'Required for a PARCEL; ignored for a RIDE.',
  })
  @ValidateIf(isParcel)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  recipientName?: string;

  @ApiPropertyOptional({
    example: '+201001234567',
    description: 'Egyptian number. Required for a PARCEL; ignored for a RIDE.',
  })
  @ValidateIf(isParcel)
  @IsPhoneNumber('EG')
  recipientPhone?: string;

  @ApiPropertyOptional({ example: 'Small box, fragile' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  packageDescription?: string;
}

export default CreateTripDto;

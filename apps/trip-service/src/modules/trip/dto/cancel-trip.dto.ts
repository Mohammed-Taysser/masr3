import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

class CancelTripDto {
  @ApiPropertyOptional({ example: 'Booked by mistake' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export default CancelTripDto;

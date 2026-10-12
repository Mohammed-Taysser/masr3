import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

class CountResponseDto {
  @Expose()
  @ApiProperty({ example: 3 })
  count: number;
}

export default CountResponseDto;

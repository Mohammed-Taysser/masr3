import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

class DriverSummaryResponseDto {
  @Expose()
  @ApiProperty({ example: 5, description: 'auth-service user id.' })
  userId: number;

  @Expose()
  @ApiProperty({ example: 'Omar' })
  firstName: string;

  @Expose()
  @ApiProperty({ example: 'Hassan' })
  lastName: string;

  @Expose()
  @ApiProperty({ example: true })
  isActive: boolean;
}

export default DriverSummaryResponseDto;

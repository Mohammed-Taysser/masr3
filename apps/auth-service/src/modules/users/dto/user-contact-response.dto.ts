import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

class UserContactResponseDto {
  @Expose()
  @ApiProperty({ example: 2, description: 'Id of the user.' })
  userId: number;

  @Expose()
  @ApiProperty({ format: 'email', example: 'customer@masr3.local' })
  email: string;

  @Expose()
  @ApiProperty({ example: 'Demo' })
  firstName: string;

  @Expose()
  @ApiProperty({ example: 'Customer' })
  lastName: string;
}

export default UserContactResponseDto;

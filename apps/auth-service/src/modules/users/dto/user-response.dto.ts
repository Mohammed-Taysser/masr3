import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { UserRoleEnum } from '@masr3/libs/auth';

class UserResponseDto {
  @Expose()
  @ApiProperty({ example: 2, description: 'Primary key.' })
  id: number;

  @Expose()
  @ApiProperty({ format: 'email', example: 'customer@masr3.local' })
  email: string;

  @Expose()
  @ApiProperty({
    enum: UserRoleEnum,
    example: UserRoleEnum.CUSTOMER,
    description:
      '`ADMIN` is required by `PATCH /api/users/:id/status`. `CUSTOMER` and `DRIVER` are not yet treated differently by any endpoint.',
  })
  role: UserRoleEnum;

  @Expose()
  @ApiProperty({ example: 'Demo' })
  firstName: string;

  @Expose()
  @ApiProperty({ example: 'Customer' })
  lastName: string;

  @Expose()
  @ApiProperty({
    format: 'date-time',
    example: '2026-09-20T08:20:46.408Z',
    description: 'Account creation time, UTC.',
  })
  createdAt: Date;
}

export default UserResponseDto;

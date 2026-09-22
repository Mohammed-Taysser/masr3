import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import UserResponseDto from '../../users/dto/user-response.dto';

class AuthResponseDto {
  @Expose()
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsImVtYWlsIjoiY3VzdG9tZXJAbWFzcjMubG9jYWwifQ.',
    description:
      'JWT access token. Send it as `Authorization: Bearer <token>` when calling protected endpoints.',
  })
  accessToken: string;

  @Expose()
  @Type(() => UserResponseDto)
  @ApiProperty({
    type: UserResponseDto,
    description:
      'The authenticated account without its password or password-reset data.',
  })
  user: UserResponseDto;
}

export default AuthResponseDto;

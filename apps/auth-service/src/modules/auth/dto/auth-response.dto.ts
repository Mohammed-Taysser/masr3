import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import UserResponseDto from '../../users/dto/user-response.dto';
import AccessTokenResponseDto from './access-token-response.dto';

class AuthResponseDto extends AccessTokenResponseDto {
  @Expose()
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik56YkxzWGg4In0...',
    description:
      'Stateless refresh token, accepted only by `POST /api/auth/refresh`. Its expiry is fixed: refreshing never extends it. Logout, a password change or reset, deactivation and a role change revoke every refresh token of the user.',
  })
  refreshToken: string;

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

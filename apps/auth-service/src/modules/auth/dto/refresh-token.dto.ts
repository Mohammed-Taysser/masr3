import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik56YkxzWGg4In0...',
    description: 'The refresh token returned by login or register.',
  })
  @IsJWT()
  refreshToken: string;
}

export default RefreshTokenDto;

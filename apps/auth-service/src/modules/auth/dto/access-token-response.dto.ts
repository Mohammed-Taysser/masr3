import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

class AccessTokenResponseDto {
  @Expose()
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik56YkxzWGg4In0...',
    description:
      'RS256 access token. Send it as `Authorization: Bearer <token>`. Every service verifies it locally against `GET /api/.well-known/jwks.json`.',
  })
  accessToken: string;

  @Expose()
  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @Expose()
  @ApiProperty({
    example: 300,
    description: 'Seconds until the access token expires.',
  })
  expiresIn: number;
}

export default AccessTokenResponseDto;

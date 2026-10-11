import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

class ServiceTokenResponseDto {
  @Expose()
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik56YkxzWGg4In0...',
    description:
      'RS256 service token for the requested audience and scopes. Cache it until shortly before it expires.',
  })
  accessToken: string;

  @Expose()
  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @Expose()
  @ApiProperty({
    example: 300,
    description: 'Seconds until the token expires.',
  })
  expiresIn: number;
}

export default ServiceTokenResponseDto;

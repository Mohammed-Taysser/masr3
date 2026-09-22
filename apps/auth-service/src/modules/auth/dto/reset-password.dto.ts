import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

class ResetPasswordDto {
  @ApiProperty({
    example: '3f9a1c8e7b2d4f60a5e1c9b3d7f20486',
    description:
      'The raw token received in the password-reset link. Only its SHA-256 hash is stored in the database.',
  })
  @IsString()
  token: string;

  @ApiProperty({
    format: 'password',
    minLength: 8,
    example: 'EvenBetter456!',
    description:
      'The new password. At least 8 characters. Resetting the password revokes the account’s existing access tokens.',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export default ResetPasswordDto;

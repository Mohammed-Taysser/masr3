import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

class ChangePasswordDto {
  @ApiProperty({
    format: 'password',
    example: 'ChangeMe123!',
    description:
      'The password currently in use. An incorrect password is treated as an authentication failure.',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    format: 'password',
    minLength: 8,
    example: 'EvenBetter456!',
    description:
      'The new password. At least 8 characters. Changing the password revokes the account’s existing access tokens.',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export default ChangePasswordDto;

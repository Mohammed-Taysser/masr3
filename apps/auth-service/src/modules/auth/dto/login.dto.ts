import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

class LoginDto {
  @ApiProperty({
    format: 'email',
    example: 'customer@masr3.local',
    description: 'The email address the account was registered with.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    format: 'password',
    example: 'ChangeMe123!',
    description:
      'An incorrect password and an unknown email produce the same 401 response.',
  })
  @IsString()
  password: string;
}

export default LoginDto;

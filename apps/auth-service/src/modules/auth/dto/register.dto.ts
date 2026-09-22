import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

class RegisterDto {
  @ApiProperty({
    format: 'email',
    example: 'nour.hassan@masr3.local',
    description:
      'Must be unique. A duplicate email is rejected with `Email is already registered`.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    format: 'password',
    minLength: 8,
    example: 'ChangeMe123!',
    description:
      'At least 8 characters. Hashed before storage and never returned by any endpoint.',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'Nour',
    description: 'Given name.',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    example: 'Hassan',
    description: 'Family name.',
  })
  @IsString()
  lastName: string;
}

export default RegisterDto;

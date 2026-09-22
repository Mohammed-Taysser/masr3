import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRoleEnum } from '../users.enum';

class CreateUserDto {
  @ApiProperty({
    format: 'email',
    example: 'nour.hassan@masr3.local',
    description: 'Must be unique.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    format: 'password',
    minLength: 8,
    example: 'ChangeMe123!',
    description: 'Already hashed by the caller — this layer does not hash.',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Nour' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Hassan' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({
    enum: UserRoleEnum,
    default: UserRoleEnum.CUSTOMER,
    description:
      'Defaults to `CUSTOMER` at the database level when omitted, which is what public registration relies on.',
  })
  @IsOptional()
  @IsEnum(UserRoleEnum)
  role?: UserRoleEnum;
}

export default CreateUserDto;

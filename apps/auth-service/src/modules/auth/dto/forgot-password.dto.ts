import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

class ForgotPasswordDto {
  @ApiProperty({
    format: 'email',
    example: 'customer@masr3.local',
    description:
      'The email address associated with the account. The endpoint returns the same response whether the account exists or not.',
  })
  @IsEmail()
  email: string;
}

export default ForgotPasswordDto;

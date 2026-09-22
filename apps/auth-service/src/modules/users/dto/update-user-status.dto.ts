import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

class UpdateUserStatusDto {
  @ApiProperty({
    example: true,
    description:
      '`false` blocks sign-in (`Account is deactivated`) and stops the account’s existing tokens working immediately, because the JWT strategy re-reads this flag on every guarded request.',
  })
  @IsBoolean()
  isActive: boolean;
}

export default UpdateUserStatusDto;

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

class UpdateChannelPreferencesDto {
  @ApiPropertyOptional({ example: true, description: 'Email on or off.' })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiPropertyOptional({ example: false, description: 'SMS on or off.' })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;

  @ApiPropertyOptional({ example: true, description: 'WhatsApp on or off.' })
  @IsOptional()
  @IsBoolean()
  whatsapp?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Mobile push on or off.' })
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'The in-app inbox on or off.',
  })
  @IsOptional()
  @IsBoolean()
  inApp?: boolean;
}

export default UpdateChannelPreferencesDto;

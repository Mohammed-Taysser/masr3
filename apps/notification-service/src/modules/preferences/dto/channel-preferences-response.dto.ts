import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

class ChannelPreferencesResponseDto {
  @Expose()
  @ApiProperty({ example: true })
  email: boolean;

  @Expose()
  @ApiProperty({ example: false })
  sms: boolean;

  @Expose()
  @ApiProperty({ example: true })
  whatsapp: boolean;

  @Expose()
  @ApiProperty({ example: true })
  push: boolean;

  @Expose()
  @ApiProperty({ example: true })
  inApp: boolean;
}

export default ChannelPreferencesResponseDto;

import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsString,
  MinLength,
} from 'class-validator';

import { ServiceScopeEnum } from '@masr3/libs';

class CreateServiceTokenDto {
  @ApiProperty({
    example: 'auth-service',
    description:
      "The receiving service, as its SERVICE_NAME. Must be in the calling client's allowed audiences.",
  })
  @IsString()
  @MinLength(1)
  audience: string;

  @ApiProperty({
    enum: ServiceScopeEnum,
    isArray: true,
    example: [ServiceScopeEnum.USERS_CONTACT_READ],
    description: "Every scope must be in the calling client's allowed scopes.",
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ServiceScopeEnum, { each: true })
  scopes: ServiceScopeEnum[];
}

export default CreateServiceTokenDto;

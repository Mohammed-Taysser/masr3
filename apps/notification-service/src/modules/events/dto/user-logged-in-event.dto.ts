import { IsOptional, IsString } from 'class-validator';

import { UserLoggedInEvent } from '@masr3/libs';

import AuthEventDto from './auth-event.dto';

class UserLoggedInEventDto extends AuthEventDto implements UserLoggedInEvent {
  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export default UserLoggedInEventDto;

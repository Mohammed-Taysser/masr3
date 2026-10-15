import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';

import { PasswordResetRequestedEvent } from '@masr3/libs/kafka';

import AuthEventDto from './auth-event.dto';

class PasswordResetRequestedEventDto
  extends AuthEventDto
  implements PasswordResetRequestedEvent
{
  // Without it there is no link to send.
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  // The email states how long the link lasts; an unparsable date would
  // render as "NaN minutes".
  @IsISO8601({ strict: true })
  expiresAt: string;
}

export default PasswordResetRequestedEventDto;

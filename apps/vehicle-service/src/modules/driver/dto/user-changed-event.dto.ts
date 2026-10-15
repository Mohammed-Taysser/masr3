import { IsBoolean, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

import { UserRoleEnum } from '@masr3/libs/auth';
import {
  KafkaEventDto,
  UserChangedEvent,
  UserChangeEnum,
} from '@masr3/libs/kafka';

// role and change are checked as strings, not enums: a value auth-service adds
// later must still reach the handler (an unknown role is simply not a
// driver) instead of being dropped as malformed.
class UserChangedEventDto extends KafkaEventDto implements UserChangedEvent {
  @IsInt()
  @Min(1)
  userId: number;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  role: UserRoleEnum;

  @IsBoolean()
  isActive: boolean;

  @IsString()
  @IsNotEmpty()
  change: UserChangeEnum;
}

export default UserChangedEventDto;

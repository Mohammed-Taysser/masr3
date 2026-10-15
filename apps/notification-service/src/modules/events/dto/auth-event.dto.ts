import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

import { BaseAuthEvent, KafkaEventDto } from '@masr3/libs/kafka';

// Every auth.* topic; the ones with extra fields extend it.
class AuthEventDto extends KafkaEventDto implements BaseAuthEvent {
  @IsInt()
  @Min(1)
  userId: number;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  firstName: string;
}

export default AuthEventDto;

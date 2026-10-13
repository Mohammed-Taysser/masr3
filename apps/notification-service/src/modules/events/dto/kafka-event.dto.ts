import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';

import { BaseKafkaEvent } from '@masr3/libs';

// The fields every event carries. A message without them can never be
// deduplicated or dated, so the consumer skips it.
class KafkaEventDto implements BaseKafkaEvent {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsISO8601({ strict: true })
  occurredAt: string;
}

export default KafkaEventDto;

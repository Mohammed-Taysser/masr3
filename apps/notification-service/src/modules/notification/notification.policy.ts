import { ConflictException } from '@nestjs/common';

import NotificationDeliveryEntity from './entities/notification-delivery.entity';
import { DeliveryStatusEnum } from './notification.enum';

// Only a FAILED delivery is retried by hand: a QUEUED one is still in BullMQ,
// and a SENT or SKIPPED one must not reach the user twice.
function assertDeliveryRetryable(
  delivery: Pick<NotificationDeliveryEntity, 'status'>,
): void {
  if (delivery.status !== DeliveryStatusEnum.FAILED) {
    throw new ConflictException(
      `Only a FAILED delivery can be retried; this one is ${delivery.status}`,
    );
  }
}

export { assertDeliveryRetryable };

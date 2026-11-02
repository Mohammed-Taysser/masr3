import { ConflictException } from '@nestjs/common';

import { DeliveryStatusEnum } from '../notification.enum';
import { assertDeliveryRetryable } from '../notification.policy';

describe('assertDeliveryRetryable', () => {
  it('allows a FAILED delivery', () => {
    expect(() =>
      assertDeliveryRetryable({ status: DeliveryStatusEnum.FAILED }),
    ).not.toThrow();
  });

  it.each(
    Object.values(DeliveryStatusEnum).filter(
      (status) => status !== DeliveryStatusEnum.FAILED,
    ),
  )('conflicts on a %s delivery', (status) => {
    expect(() => assertDeliveryRetryable({ status })).toThrow(
      ConflictException,
    );
  });
});

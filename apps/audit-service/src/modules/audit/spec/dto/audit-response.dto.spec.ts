import { instanceToPlain, plainToInstance } from 'class-transformer';

import AuditResponseDto from '../../dto/audit-response.dto';

describe('AuditResponseDto', () => {
  // The global ClassSerializerInterceptor uses excludeExtraneousValues: the
  // jsonb columns must come through whole, not as {}.
  it('keeps changes and metadata intact', () => {
    const changes = { status: { old: 'REQUESTED', new: 'ACCEPTED' } };
    const metadata = {
      reason: 'Driver did not arrive',
      attempt: { number: 2 },
    };

    const dto = plainToInstance(
      AuditResponseDto,
      { id: 1, changes, metadata, secret: 'dropped' },
      { excludeExtraneousValues: true },
    );
    const plain = instanceToPlain(dto, { excludeExtraneousValues: true });

    expect(plain['changes']).toEqual(changes);
    expect(plain['metadata']).toEqual(metadata);
    expect(plain).not.toHaveProperty('secret');
  });
});

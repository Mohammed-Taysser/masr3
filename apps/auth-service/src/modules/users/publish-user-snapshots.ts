import 'reflect-metadata';

import { AuthKafkaTopic, UserChangeEnum } from '@masr3/libs/kafka';
import { OutboxService } from '@masr3/libs/outbox';

import dataSource from '../../database/data-source';
import { OutboxEventMap } from '../../kafka/kafka.interface';
import UserEntity from './entities/user.entity';
import { buildUserChangedEvent } from './user-changed.event';

// One-off backfill: users written before auth.user-changed existed (the seed,
// older accounts) were never published. Enqueues a snapshot of every user;
// the running relay sends them. Consumers upsert, so running it twice is safe.
async function publishUserSnapshots(): Promise<void> {
  await dataSource.initialize();

  try {
    const outboxService = new OutboxService<OutboxEventMap>();

    const count = await dataSource.transaction(async (manager) => {
      const users = await manager.find(UserEntity, { order: { id: 'ASC' } });

      for (const user of users) {
        await outboxService.enqueue(
          manager,
          AuthKafkaTopic.USER_CHANGED,
          buildUserChangedEvent(user, UserChangeEnum.CREATED),
          String(user.id),
        );
      }

      return users.length;
    });

    console.log(`Enqueued ${count} auth.user-changed snapshot(s)`);
  } finally {
    await dataSource.destroy();
  }
}

publishUserSnapshots().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueNotificationPerRecipient1791784650554 implements MigrationInterface {
  name = 'UniqueNotificationPerRecipient1791784650554';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "UQ_3337493bfdc5d0fccd4bd5f51e3"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notifications_event_recipient" ON "notifications"  ("eventId", "recipient") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_notifications_event_recipient"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "UQ_3337493bfdc5d0fccd4bd5f51e3" UNIQUE ("eventId")`,
    );
  }
}

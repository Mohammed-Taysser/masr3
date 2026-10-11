import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationUpdatedAt1790840442026 implements MigrationInterface {
  name = 'AddNotificationUpdatedAt1790840442026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "updatedAt"`,
    );
  }
}

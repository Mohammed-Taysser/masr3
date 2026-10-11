import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseUtcTimestamps1791715551507 implements MigrationInterface {
  name = 'UseUtcTimestamps1791715551507';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "passwordResetExpiresAt" TYPE TIMESTAMP WITH TIME ZONE USING "passwordResetExpiresAt" AT TIME ZONE 'Africa/Cairo'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE USING "updatedAt" AT TIME ZONE 'UTC'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITHOUT TIME ZONE USING "updatedAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITHOUT TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "passwordResetExpiresAt" TYPE TIMESTAMP WITHOUT TIME ZONE USING "passwordResetExpiresAt" AT TIME ZONE 'Africa/Cairo'`,
    );
  }
}

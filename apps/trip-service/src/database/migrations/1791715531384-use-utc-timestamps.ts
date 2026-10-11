import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseUtcTimestamps1791715531384 implements MigrationInterface {
  name = 'UseUtcTimestamps1791715531384';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trips" ALTER COLUMN "expiresAt" TYPE TIMESTAMP WITH TIME ZONE USING "expiresAt" AT TIME ZONE 'Africa/Cairo'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE USING "updatedAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_offers" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_offers" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE USING "updatedAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_status_history" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ALTER COLUMN "publishedAt" TYPE TIMESTAMP WITH TIME ZONE USING "publishedAt" AT TIME ZONE 'Africa/Cairo'`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITHOUT TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ALTER COLUMN "publishedAt" TYPE TIMESTAMP WITHOUT TIME ZONE USING "publishedAt" AT TIME ZONE 'Africa/Cairo'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_status_history" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITHOUT TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_offers" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITHOUT TIME ZONE USING "updatedAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_offers" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITHOUT TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITHOUT TIME ZONE USING "updatedAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITHOUT TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ALTER COLUMN "expiresAt" TYPE TIMESTAMP WITHOUT TIME ZONE USING "expiresAt" AT TIME ZONE 'Africa/Cairo'`,
    );
  }
}

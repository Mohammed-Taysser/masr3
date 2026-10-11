import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsTable1790493347793 implements MigrationInterface {
  name = 'CreateNotificationsTable1790493347793';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_channel_enum" AS ENUM('EMAIL', 'SMS', 'PUSH')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_status_enum" AS ENUM('PENDING', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" SERIAL NOT NULL, "eventId" character varying, "channel" "public"."notifications_channel_enum" NOT NULL, "recipient" character varying NOT NULL, "template" character varying NOT NULL, "subject" character varying NOT NULL, "body" text, "status" "public"."notifications_status_enum" NOT NULL, "error" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_3337493bfdc5d0fccd4bd5f51e3" UNIQUE ("eventId"), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b78edd430e2dc39d22fb49ff64" ON "notifications"  ("recipient") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_92f5d3a7779be163cbea7916c6" ON "notifications"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_831a5a06f879fb0bebf8965871" ON "notifications"  ("createdAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_831a5a06f879fb0bebf8965871"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_92f5d3a7779be163cbea7916c6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b78edd430e2dc39d22fb49ff64"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_channel_enum"`);
  }
}

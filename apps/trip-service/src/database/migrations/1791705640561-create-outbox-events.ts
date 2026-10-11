import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutboxEvents1791705640561 implements MigrationInterface {
  name = 'CreateOutboxEvents1791705640561';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "outbox_events" ("id" SERIAL NOT NULL, "eventId" character varying NOT NULL, "topic" character varying NOT NULL, "key" character varying NOT NULL, "payload" jsonb NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "lastError" character varying, "publishedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2e11b9ee3518231eeea21f93c44" UNIQUE ("eventId"), CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9e1316bd6e766431092cd9ce40" ON "outbox_events"  ("publishedAt", "id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9e1316bd6e766431092cd9ce40"`,
    );
    await queryRunner.query(`DROP TABLE "outbox_events"`);
  }
}

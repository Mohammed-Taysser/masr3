import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAudits1791872057530 implements MigrationInterface {
  name = 'CreateAudits1791872057530';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audits" ("id" SERIAL NOT NULL, "eventId" character varying NOT NULL, "schemaVersion" integer NOT NULL, "service" character varying NOT NULL, "action" character varying NOT NULL, "entityType" character varying NOT NULL, "entityId" integer NOT NULL, "actorType" character varying NOT NULL, "actorId" integer, "actorRole" character varying, "changes" jsonb, "metadata" jsonb, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b2d7a2089999197dc7024820f28" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_919eacf1082bc3541c3e7a6d9c" ON "audits"  ("action", "occurredAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e7d1b0803e7a616a429b44aa8d" ON "audits"  ("service", "occurredAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fb56ccf8616aac76e08b88a02b" ON "audits"  ("actorId", "occurredAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e03be9e89b6b0bea0a80124daf" ON "audits"  ("entityType", "entityId", "occurredAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_audits_event_id" ON "audits"  ("eventId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_audits_event_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e03be9e89b6b0bea0a80124daf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fb56ccf8616aac76e08b88a02b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e7d1b0803e7a616a429b44aa8d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_919eacf1082bc3541c3e7a6d9c"`,
    );
    await queryRunner.query(`DROP TABLE "audits"`);
  }
}

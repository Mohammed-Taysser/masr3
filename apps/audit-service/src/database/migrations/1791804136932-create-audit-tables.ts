import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuditTables1791804136932 implements MigrationInterface {
    name = 'CreateAuditTables1791804136932'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_log" ("id" SERIAL NOT NULL, "schemaVersion" integer NOT NULL DEFAULT '1', "service" character varying NOT NULL, "action" character varying NOT NULL, "entityType" character varying NOT NULL, "entityId" character varying NOT NULL, "actorType" character varying NOT NULL, "actorId" character varying, "changes" jsonb, "metadata" jsonb, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6f9871caccef316c8fef48a494" ON "audit_log"  ("service", "occurredAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_7db49c5491b697ac14982af2f5" ON "audit_log"  ("actorId", "occurredAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_9310020e843f7c6544095cfce5" ON "audit_log"  ("entityType", "entityId", "occurredAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_9310020e843f7c6544095cfce5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7db49c5491b697ac14982af2f5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6f9871caccef316c8fef48a494"`);
        await queryRunner.query(`DROP TABLE "audit_log"`);
    }

}

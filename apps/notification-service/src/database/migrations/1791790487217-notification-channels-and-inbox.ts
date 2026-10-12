import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationChannelsAndInbox1791790487217 implements MigrationInterface {
  name = 'NotificationChannelsAndInbox1791790487217';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_notifications_event_recipient"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_92f5d3a7779be163cbea7916c6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b78edd430e2dc39d22fb49ff64"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_deliveries_channel_enum" AS ENUM('EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_deliveries_status_enum" AS ENUM('QUEUED', 'SENT', 'FAILED', 'SKIPPED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_deliveries_skipreason_enum" AS ENUM('RECIPIENT_NOT_FOUND', 'OPTED_OUT', 'PROVIDER_NOT_CONFIGURED', 'MISSING_CONTACT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_deliveries" ("id" SERIAL NOT NULL, "notificationId" integer NOT NULL, "channel" "public"."notification_deliveries_channel_enum" NOT NULL, "address" character varying, "status" "public"."notification_deliveries_status_enum" NOT NULL, "skipReason" "public"."notification_deliveries_skipreason_enum", "attempts" integer NOT NULL DEFAULT '0', "providerMessageId" character varying, "subject" character varying, "lastError" text, "sentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_81daeff81f237bd384f7cfc4a4c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50ffb57b26e6d4538dbcada8b1" ON "notification_deliveries"  ("status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notification_deliveries_channel" ON "notification_deliveries"  ("notificationId", "channel") `,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_preferences" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "email" boolean NOT NULL DEFAULT true, "sms" boolean NOT NULL DEFAULT true, "whatsapp" boolean NOT NULL DEFAULT true, "push" boolean NOT NULL DEFAULT true, "inApp" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notification_preferences_user" ON "notification_preferences"  ("userId") `,
    );
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "error"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_status_enum"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "subject"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "template"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "recipient"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "channel"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_channel_enum"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "eventId"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('WELCOME', 'NEW_LOGIN', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'PASSWORD_RESET_COMPLETED', 'TRIP_CONFIRMED', 'TRIP_ASSIGNED', 'TRIP_RECEIPT', 'TRIP_CANCELLED', 'TRIP_EXPIRED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "type" "public"."notifications_type_enum" NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_category_enum" AS ENUM('SECURITY', 'ACCOUNT', 'TRIP')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "category" "public"."notifications_category_enum" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "userId" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "dedupeKey" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "data" jsonb NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "attachments" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "locale" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "recipientName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "title" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "deepLink" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "inboxAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "readAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "archivedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fafc1466260483438ad15f9b7a" ON "notifications"  ("userId", "inboxAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notifications_dedupe_key" ON "notifications"  ("dedupeKey") `,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_deliveries" ADD CONSTRAINT "FK_480dc696b3c108f40b394d65faf" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_deliveries" DROP CONSTRAINT "FK_480dc696b3c108f40b394d65faf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_notifications_dedupe_key"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fafc1466260483438ad15f9b7a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "archivedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "readAt"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "inboxAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "deepLink"`,
    );
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "title"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "recipientName"`,
    );
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "locale"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "attachments"`,
    );
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "data"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "dedupeKey"`,
    );
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "userId"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "category"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_category_enum"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "type"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "eventId" character varying`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_channel_enum" AS ENUM('EMAIL', 'SMS', 'PUSH')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "channel" "public"."notifications_channel_enum" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "recipient" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "template" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "subject" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_status_enum" AS ENUM('PENDING', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "status" "public"."notifications_status_enum" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "error" character varying`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_notification_preferences_user"`,
    );
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_notification_deliveries_channel"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50ffb57b26e6d4538dbcada8b1"`,
    );
    await queryRunner.query(`DROP TABLE "notification_deliveries"`);
    await queryRunner.query(
      `DROP TYPE "public"."notification_deliveries_skipreason_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."notification_deliveries_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."notification_deliveries_channel_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b78edd430e2dc39d22fb49ff64" ON "notifications" USING btree ("recipient") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_92f5d3a7779be163cbea7916c6" ON "notifications" USING btree ("status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notifications_event_recipient" ON "notifications" USING btree ("recipient", "eventId") `,
    );
  }
}

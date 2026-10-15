import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVehicleTables1792044764128 implements MigrationInterface {
  name = 'CreateVehicleTables1792044764128';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "drivers" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "isActive" boolean NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_92ab3fb69e566d3eb0cae896047" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_drivers_user_id" ON "drivers"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "outbox_events" ("id" SERIAL NOT NULL, "eventId" character varying NOT NULL, "topic" character varying NOT NULL, "key" character varying NOT NULL, "payload" jsonb NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "lastError" character varying, "publishedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2e11b9ee3518231eeea21f93c44" UNIQUE ("eventId"), CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9e1316bd6e766431092cd9ce40" ON "outbox_events"  ("publishedAt", "id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vehicles_type_enum" AS ENUM('MOTORCYCLE', 'CAR', 'VAN', 'TRUCK', 'BICYCLE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vehicles_verificationstatus_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vehicles_operationalstatus_enum" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vehicles" ("id" SERIAL NOT NULL, "driverId" integer NOT NULL, "type" "public"."vehicles_type_enum" NOT NULL, "manufacturer" character varying NOT NULL, "model" character varying NOT NULL, "year" integer NOT NULL, "plateNumber" character varying NOT NULL, "color" character varying, "verificationStatus" "public"."vehicles_verificationstatus_enum" NOT NULL DEFAULT 'PENDING', "operationalStatus" "public"."vehicles_operationalstatus_enum" NOT NULL DEFAULT 'INACTIVE', "isDefault" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_vehicles_driver_default" ON "vehicles"  ("driverId") WHERE "isDefault" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_vehicles_plate_number" ON "vehicles"  ("plateNumber") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_28d7607488252336b22511e9e8" ON "vehicles"  ("driverId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_28d7607488252336b22511e9e8"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_vehicles_plate_number"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_vehicles_driver_default"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(
      `DROP TYPE "public"."vehicles_operationalstatus_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."vehicles_verificationstatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."vehicles_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9e1316bd6e766431092cd9ce40"`,
    );
    await queryRunner.query(`DROP TABLE "outbox_events"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_drivers_user_id"`);
    await queryRunner.query(`DROP TABLE "drivers"`);
  }
}

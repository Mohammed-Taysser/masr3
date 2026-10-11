import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTripTables1791697695359 implements MigrationInterface {
  name = 'CreateTripTables1791697695359';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."trips_type_enum" AS ENUM('RIDE', 'PARCEL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."trips_status_enum" AS ENUM('REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "trips" ("id" SERIAL NOT NULL, "customerId" integer NOT NULL, "driverId" integer, "type" "public"."trips_type_enum" NOT NULL, "status" "public"."trips_status_enum" NOT NULL, "pickupLatitude" double precision NOT NULL, "pickupLongitude" double precision NOT NULL, "pickupAddress" character varying NOT NULL, "dropoffLatitude" double precision NOT NULL, "dropoffLongitude" double precision NOT NULL, "dropoffAddress" character varying NOT NULL, "proposedFare" numeric(10,2) NOT NULL, "agreedFare" numeric(10,2), "recipientName" character varying, "recipientPhone" character varying, "packageDescription" character varying, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_trips_parcel_recipient" CHECK ("type" <> 'PARCEL' OR ("recipientName" IS NOT NULL AND "recipientPhone" IS NOT NULL)), CONSTRAINT "PK_f71c231dee9c05a9522f9e840f5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fc5a8911f85074a660a4304baa" ON "trips"  ("driverId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_330b16f389884418fabd817bae" ON "trips"  ("customerId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1e9de13bac402d95dad6f116e0" ON "trips"  ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."trip_status_history_fromstatus_enum" AS ENUM('REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."trip_status_history_tostatus_enum" AS ENUM('REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."trip_status_history_actor_enum" AS ENUM('CUSTOMER', 'DRIVER', 'ADMIN', 'SYSTEM')`,
    );
    await queryRunner.query(
      `CREATE TABLE "trip_status_history" ("id" SERIAL NOT NULL, "tripId" integer NOT NULL, "fromStatus" "public"."trip_status_history_fromstatus_enum", "toStatus" "public"."trip_status_history_tostatus_enum" NOT NULL, "actor" "public"."trip_status_history_actor_enum" NOT NULL, "actorId" integer, "reason" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ca0b5f74d80045e7d74e71f243e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2a61b15bfd010ce3d146ad44e5" ON "trip_status_history"  ("tripId", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_status_history" ADD CONSTRAINT "FK_8c8ffd52531e7da8116159df295" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trip_status_history" DROP CONSTRAINT "FK_8c8ffd52531e7da8116159df295"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2a61b15bfd010ce3d146ad44e5"`,
    );
    await queryRunner.query(`DROP TABLE "trip_status_history"`);
    await queryRunner.query(
      `DROP TYPE "public"."trip_status_history_actor_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."trip_status_history_tostatus_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."trip_status_history_fromstatus_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1e9de13bac402d95dad6f116e0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_330b16f389884418fabd817bae"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fc5a8911f85074a660a4304baa"`,
    );
    await queryRunner.query(`DROP TABLE "trips"`);
    await queryRunner.query(`DROP TYPE "public"."trips_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."trips_type_enum"`);
  }
}

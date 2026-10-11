import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTripOffers1791706910250 implements MigrationInterface {
  name = 'CreateTripOffers1791706910250';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."trip_offers_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "trip_offers" ("id" SERIAL NOT NULL, "tripId" integer NOT NULL, "driverId" integer NOT NULL, "amount" numeric(10,2) NOT NULL, "status" "public"."trip_offers_status_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_194ea83cee0778ce59744fa464c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_trip_offers_pending_driver" ON "trip_offers"  ("tripId", "driverId") WHERE "status" = 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_047274c9a15792ee7123de5a71" ON "trip_offers"  ("driverId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_78ae76858b7d132355b002115b" ON "trip_offers"  ("tripId", "status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_offers" ADD CONSTRAINT "FK_4b2918cf64b347a055d4f5b51c7" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trip_offers" DROP CONSTRAINT "FK_4b2918cf64b347a055d4f5b51c7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_78ae76858b7d132355b002115b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_047274c9a15792ee7123de5a71"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_trip_offers_pending_driver"`,
    );
    await queryRunner.query(`DROP TABLE "trip_offers"`);
    await queryRunner.query(`DROP TYPE "public"."trip_offers_status_enum"`);
  }
}

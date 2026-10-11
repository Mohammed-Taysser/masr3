import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveTripIndexes1791698146112 implements MigrationInterface {
  name = 'AddActiveTripIndexes1791698146112';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_trips_active_driver" ON "trips"  ("driverId") WHERE "status" IN ('ACCEPTED', 'DRIVER_ARRIVED', 'IN_PROGRESS')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_trips_active_customer" ON "trips"  ("customerId") WHERE "status" IN ('REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'IN_PROGRESS')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_trips_active_customer"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_trips_active_driver"`);
  }
}

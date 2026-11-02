import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTripRequestedVehicleType1792323172270 implements MigrationInterface {
  name = 'AddTripRequestedVehicleType1792323172270';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."trips_requestedvehicletype_enum" AS ENUM('MOTORCYCLE', 'CAR', 'VAN', 'TRUCK', 'BICYCLE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD "requestedVehicleType" "public"."trips_requestedvehicletype_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trips" DROP COLUMN "requestedVehicleType"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."trips_requestedvehicletype_enum"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameRiderRoleToDriver1791696374495 implements MigrationInterface {
  name = 'RenameRiderRoleToDriver1791696374495';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" RENAME TO "users_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('CUSTOMER', 'DRIVER', 'ADMIN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum" USING (CASE "role"::"text" WHEN 'RIDER' THEN 'DRIVER' ELSE "role"::"text" END)::"public"."users_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER'`,
    );
    await queryRunner.query(`DROP TYPE "public"."users_role_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum_old" AS ENUM('CUSTOMER', 'RIDER', 'ADMIN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum_old" USING (CASE "role"::"text" WHEN 'DRIVER' THEN 'RIDER' ELSE "role"::"text" END)::"public"."users_role_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER'`,
    );
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum_old" RENAME TO "users_role_enum"`,
    );
  }
}

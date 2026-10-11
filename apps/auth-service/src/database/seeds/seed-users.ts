import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';

import dataSource from '../data-source';
import UserEntity from '../../modules/users/entities/user.entity';
import { UserRoleEnum } from '../../modules/users/users.enum';
import PasswordService from '../../modules/auth/services/password.service';

interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRoleEnum;
  isActive?: boolean;
}

const passwordService = new PasswordService();

async function seed(): Promise<void> {
  const seedFilePath = path.join(__dirname, 'data', 'users.seed.json');

  const seedUsers: SeedUser[] = JSON.parse(
    fs.readFileSync(seedFilePath, 'utf-8'),
  );

  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository(UserEntity);

    let seededCount = 0;
    let skippedCount = 0;

    for (const seedUser of seedUsers) {
      const email = seedUser.email.trim().toLowerCase();

      const existing = await repo.findOne({
        where: { email },
      });

      if (existing) {
        skippedCount++;

        console.log(`Seed skipped: ${email} already exists`);

        continue;
      }

      const password = await passwordService.hash(seedUser.password);

      const user = repo.create({
        email,
        password,
        firstName: seedUser.firstName.trim(),
        lastName: seedUser.lastName.trim(),
        role: seedUser.role,
        isActive: seedUser.isActive ?? true,
      });

      await repo.save(user);

      seededCount++;

      console.log(`Seeded user: ${email}`);
    }

    console.log(
      `\nSeed completed: ${seededCount} created, ${skippedCount} skipped.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

import { OutboxEventEntity } from '@masr3/libs/outbox';
import UserEntity from '../modules/users/entities/user.entity';

dotenv.config({ path: path.join(process.cwd(), 'apps/auth-service/.env') });
dotenv.config({ path: path.join(process.cwd(), 'apps/auth-service/db.env') });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [UserEntity, OutboxEventEntity],
  migrations: [path.join(__dirname, 'migrations/*.ts')],
  synchronize: false,
});

export default dataSource;

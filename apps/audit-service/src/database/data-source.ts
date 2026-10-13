import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import AuditEntity from '../modules/audit/entities/audit.entity';

dotenv.config({
  path: path.join(process.cwd(), 'apps/audit-service/.env'),
});
dotenv.config({
  path: path.join(process.cwd(), 'apps/audit-service/db.env'),
});

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [AuditEntity],
  migrations: [path.join(__dirname, 'migrations/*.ts')],
  synchronize: false,
});

export default dataSource;

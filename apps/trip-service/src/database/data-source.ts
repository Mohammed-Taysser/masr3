import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import TripStatusHistoryEntity from '../modules/trip/entities/trip-status-history.entity';
import OutboxEventEntity from '../modules/outbox/entities/outbox-event.entity';
import TripEntity from '../modules/trip/entities/trip.entity';

dotenv.config({
  path: path.join(process.cwd(), 'apps/trip-service/.env'),
});
dotenv.config({
  path: path.join(process.cwd(), 'apps/trip-service/db.env'),
});

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [TripEntity, TripStatusHistoryEntity, OutboxEventEntity],
  migrations: [path.join(__dirname, 'migrations/*.ts')],
  synchronize: false,
});

export default dataSource;

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import NotificationDeliveryEntity from '../modules/notification/entities/notification-delivery.entity';
import NotificationEntity from '../modules/notification/entities/notification.entity';
import NotificationPreferenceEntity from '../modules/preferences/entities/notification-preference.entity';

dotenv.config({
  path: path.join(process.cwd(), 'apps/notification-service/.env'),
});
dotenv.config({
  path: path.join(process.cwd(), 'apps/notification-service/db.env'),
});

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [
    NotificationEntity,
    NotificationDeliveryEntity,
    NotificationPreferenceEntity,
  ],
  migrations: [path.join(__dirname, 'migrations/*.ts')],
  synchronize: false,
});

export default dataSource;

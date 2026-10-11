import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import TripStatusHistoryEntity from '../modules/trip/entities/trip-status-history.entity';
import OutboxEventEntity from '../modules/outbox/entities/outbox-event.entity';
import TripEntity from '../modules/trip/entities/trip.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('POSTGRES_DB'),
        entities: [TripEntity, TripStatusHistoryEntity, OutboxEventEntity],
        synchronize: false,
      }),
    }),
  ],
})
class DatabaseModule {}

export default DatabaseModule;

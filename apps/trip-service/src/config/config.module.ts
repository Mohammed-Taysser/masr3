import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import validate from './env/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/trip-service/.env', 'apps/trip-service/db.env'],
      validate,
    }),
  ],
})
class AppConfigModule {}

export default AppConfigModule;

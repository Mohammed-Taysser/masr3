import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import validate from './env/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        'apps/notification-service/.env',
        'apps/notification-service/db.env',
      ],
      validate,
    }),
  ],
})
class AppConfigModule {}

export default AppConfigModule;

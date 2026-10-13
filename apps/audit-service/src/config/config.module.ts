import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import validate from './env/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/audit-service/.env', 'apps/audit-service/db.env'],
      validate,
    }),
  ],
})
class AppConfigModule {}

export default AppConfigModule;

import { Module } from '@nestjs/common';
import AppController from './app.controller';
import AppService from './app.service';
import AppConfigModule from '../config/config.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [AppConfigModule,    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>[
    {
      name: 'short',
      ttl: configService.getOrThrow<number>('THROTTLE_SHORT_TTL_MS'),
      limit: configService.getOrThrow<number>('THROTTLE_SHORT_LIMIT'),
    },
    {
      name: 'medium',
      ttl: configService.getOrThrow<number>('THROTTLE_MEDIUM_TTL_MS'),
      limit: configService.getOrThrow<number>('THROTTLE_MEDIUM_LIMIT'),
    },
    {
      name: 'long',
      ttl: configService.getOrThrow<number>('THROTTLE_LONG_TTL_MS'),
      limit: configService.getOrThrow<number>('THROTTLE_LONG_LIMIT'),
    },
  ],
    }),],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export default class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
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
    }),
  ],
})
class AppThrottlerModule {}

export default AppThrottlerModule;

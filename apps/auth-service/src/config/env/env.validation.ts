import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

import { SERVICE_CLIENT_SECRET_PATTERN } from '@masr3/libs';

enum EnvironmentEnum {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

class EnvironmentVariables {
  @IsEnum(EnvironmentEnum)
  NODE_ENV: EnvironmentEnum;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  @MinLength(1)
  SERVICE_NAME: string;

  @IsString()
  @MinLength(1)
  DATABASE_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DATABASE_PORT: number;

  @IsString()
  @MinLength(1)
  POSTGRES_USER: string;

  @IsString()
  @MinLength(1)
  POSTGRES_PASSWORD: string;

  @IsString()
  @MinLength(1)
  POSTGRES_DB: string;

  @IsString()
  @MinLength(1)
  JWT_PRIVATE_KEY_FILE: string;

  // Set only during a key rotation, to keep verifying the old key's tokens.
  @IsOptional()
  @IsString()
  @MinLength(1)
  JWT_PREVIOUS_PUBLIC_KEY_FILE?: string;

  @IsInt()
  @Min(60)
  ACCESS_TOKEN_EXPIRES_IN_SECONDS: number;

  @IsInt()
  @Min(3600)
  REFRESH_TOKEN_EXPIRES_IN_SECONDS: number;

  @IsInt()
  @Min(60)
  SERVICE_TOKEN_EXPIRES_IN_SECONDS: number;

  @Matches(SERVICE_CLIENT_SECRET_PATTERN)
  NOTIFICATION_SERVICE_CLIENT_SECRET: string;

  @IsInt()
  @Min(1)
  PASSWORD_RESET_TOKEN_TTL_MS: number;

  @IsInt()
  @Min(1)
  THROTTLE_SHORT_TTL_MS: number;

  @IsInt()
  @Min(1)
  THROTTLE_SHORT_LIMIT: number;

  @IsInt()
  @Min(1)
  THROTTLE_MEDIUM_TTL_MS: number;

  @IsInt()
  @Min(1)
  THROTTLE_MEDIUM_LIMIT: number;

  @IsInt()
  @Min(1)
  THROTTLE_LONG_TTL_MS: number;

  @IsInt()
  @Min(1)
  THROTTLE_LONG_LIMIT: number;

  @IsString()
  @MinLength(1)
  KAFKA_BROKER: string;

  @IsString()
  @MinLength(1)
  KAFKA_CLIENT_ID: string;

  @IsString()
  @MinLength(1)
  REDIS_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number;

  @IsInt()
  @Min(1)
  OUTBOX_POLL_INTERVAL_MS: number;

  @IsInt()
  @Min(1)
  OUTBOX_BATCH_SIZE: number;

  @IsInt()
  @Min(1)
  OUTBOX_RETENTION_MS: number;
}

function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    const messages = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join(', ');

    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validatedConfig;
}

export default validate;

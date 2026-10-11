import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

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
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  @MinLength(1)
  JWT_EXPIRES_IN: string;

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

import 'reflect-metadata';

import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

import {
  AUTH_SERVICE_URL_PATTERN,
  SERVICE_CLIENT_SECRET_PATTERN,
} from '@masr3/libs';

import { toBoolean } from '../../shared/transformers/to-boolean.transformer';

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
  APP_NAME: string;

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
  MAIL_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  MAIL_PORT: number;

  @Transform(toBoolean)
  @IsBoolean()
  MAIL_SECURE: boolean;

  @IsString()
  @MinLength(1)
  MAIL_FROM: string;

  @IsOptional()
  @IsString()
  MAIL_USER?: string;

  @IsOptional()
  @IsString()
  MAIL_PASSWORD?: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  PASSWORD_RESET_URL_BASE: string;

  @IsString()
  @MinLength(1)
  KAFKA_BROKER: string;

  @IsString()
  @MinLength(1)
  KAFKA_CLIENT_ID: string;

  @IsString()
  @MinLength(1)
  KAFKA_CONSUMER_GROUP_ID: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  @Matches(AUTH_SERVICE_URL_PATTERN)
  AUTH_SERVICE_URL: string;

  @Matches(SERVICE_CLIENT_SECRET_PATTERN)
  SERVICE_CLIENT_SECRET: string;

  @IsString()
  @MinLength(1)
  REDIS_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number;
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

import 'reflect-metadata';

import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import AppModule from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const globalPrefix = 'api';

  app.setGlobalPrefix(globalPrefix);

  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      excludeExtraneousValues: true,
    }),
  );

  const builder = new DocumentBuilder()
    .setTitle('Trip Service')
    .setDescription(
      'Owns masr3 trips — rides and parcels, from request to completion. It exposes no trip endpoints yet — only the health probe.',
    )
    .setVersion('1.0');

  const document = SwaggerModule.createDocument(app, builder.build());
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document);

  const port = configService.get<number>('PORT');

  await app.listen(port);

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(`📘 Swagger UI: http://localhost:${port}/${globalPrefix}/docs`);
  Logger.log(
    `📄 OpenAPI JSON: http://localhost:${port}/${globalPrefix}/docs-json`,
  );
}

bootstrap();

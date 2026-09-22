import 'reflect-metadata';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import AppModule from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const globalPrefix = 'api';

  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

    const builder = new DocumentBuilder()
    .setTitle('Auth Service')
    .setDescription('Authentication and user management for masr3 — and the only service that issues access tokens. Every other service verifies what is minted here.')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    );

      const document = SwaggerModule.createDocument(app, builder.build());
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document);


  const port = configService.get<number>('PORT');

  await app.listen(port);

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(`📘 Swagger UI: http://localhost:${port}/docs`);
  Logger.log(`📄 OpenAPI JSON: http://localhost:${port}/docs-json`);
}

bootstrap();

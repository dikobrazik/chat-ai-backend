import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe());

  const isDev = app.get(ConfigService).get('IS_DEV');

  app.enableCors({
    origin: isDev
      ? [
          'http://localhost',
          'http://localhost:3000',
          'http://158.160.12.140',
          'https://tridva.store',
        ]
      : ['https://tridva.store'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  app.setGlobalPrefix('api', {
    exclude: [],
  });

  app.use(cookieParser());

  await app.listen(80);
}
bootstrap();

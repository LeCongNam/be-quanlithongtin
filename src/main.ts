import './common/bigint-json.js';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('QLTV Nhom 8').addBearerAuth().build(),
    ),
  );
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

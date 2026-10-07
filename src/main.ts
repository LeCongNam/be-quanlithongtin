import './common/bigint-json.js';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { setupSwagger } from './openapi.js';

/** Origin của FE được gọi thẳng BE từ trình duyệt; mặc định là các cổng dev của Next.js. */
const DEFAULT_CORS_ORIGINS = 'http://localhost:3001,http://localhost:3000';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  });
  setupSwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

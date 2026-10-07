import './common/bigint-json.js';
import { NestFactory } from '@nestjs/core';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Chỉ dựng tài liệu, không kết nối DB: đủ để chạy ở CI/máy chưa có .env.
process.env.JWT_SECRET ??= 'openapi-export';
process.env.DATABASE_URL ??= 'mysql://user:pass@localhost:3306/qltv_nhom8';

const { AppModule } = await import('./app.module.js');
const { buildOpenApiDocument } = await import('./openapi.js');

const out = resolve(process.argv[2] ?? 'docs/openapi.json');
const app = await NestFactory.create(AppModule, { logger: ['error'] });
await writeFile(out, `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`);
await app.close();
console.log(`Da ghi ${out}`);

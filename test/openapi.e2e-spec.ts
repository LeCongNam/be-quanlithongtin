import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../src/app.module.js';
import '../src/common/bigint-json.js';
import { buildOpenApiDocument } from '../src/openapi.js';

/**
 * Kiểm tra tài liệu Swagger mà FE dựa vào. Không cần DB (chỉ dựng module, không init app).
 * Lưu ý: vitest không chạy plugin Swagger của nest CLI nên schema của request DTO ở đây chỉ có phần khai báo
 * tường minh; phần suy luận từ DTO được kiểm tra khi `npm run openapi:export` (nest build).
 */
type Operation = {
  operationId?: string;
  summary?: string;
  description?: string;
  security?: unknown[];
  responses: Record<string, { content?: Record<string, { schema?: unknown }> }>;
  'x-roles'?: string[];
};

describe('OpenAPI document', () => {
  let app: INestApplication;
  let document: OpenAPIObject;
  let operations: { method: string; path: string; op: Operation }[];
  const find = (method: string, path: string) =>
    operations.find((o) => o.method === method && o.path === path)?.op;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    document = buildOpenApiDocument(app);
    operations = Object.entries(document.paths).flatMap(([path, item]) =>
      Object.entries(item as Record<string, Operation>).map(([method, op]) => ({
        method,
        path,
        op,
      })),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('mọi endpoint có tóm tắt, operationId duy nhất và response 2xx có schema', () => {
    expect(operations.length).toBeGreaterThan(50);
    const ids = new Set<string>();
    for (const { method, path, op } of operations) {
      const label = `${method.toUpperCase()} ${path}`;
      expect(op.summary, `${label} thiếu summary`).toBeTruthy();
      expect(op.operationId, `${label} thiếu operationId`).toBeTruthy();
      expect(ids.has(op.operationId!), `${label} trùng operationId`).toBe(
        false,
      );
      ids.add(op.operationId!);

      const ok = Object.entries(op.responses).find(([code]) =>
        code.startsWith('2'),
      );
      expect(ok, `${label} thiếu response 2xx`).toBeTruthy();
      expect(
        ok![1].content?.['application/json']?.schema,
        `${label} response 2xx không có schema`,
      ).toBeTruthy();
    }
  });

  it('endpoint cần đăng nhập khai báo 401, endpoint giới hạn vai trò khai báo thêm 403', () => {
    for (const { method, path, op } of operations) {
      const label = `${method.toUpperCase()} ${path}`;
      if (op.description?.includes('Công khai')) {
        expect(op.security, label).toBeUndefined();
        continue;
      }
      expect(op.security, `${label} thiếu security`).toBeTruthy();
      expect(op.responses['401'], `${label} thiếu 401`).toBeTruthy();
      if (op['x-roles']) {
        expect(op.responses['403'], `${label} thiếu 403`).toBeTruthy();
      }
    }
  });

  it('quyền ghi trong tài liệu khớp @Roles/@Public của controller', () => {
    expect(find('post', '/auth/login')?.description).toContain('Công khai');
    expect(find('get', '/auth/me')?.description).toContain(
      'mọi tài khoản đã đăng nhập',
    );
    expect(find('get', '/sach')?.['x-roles']).toBeUndefined();
    expect(find('post', '/sach')?.['x-roles']).toEqual(['ADMIN', 'THU_THU']);
    expect(find('delete', '/the-loai/{id}')?.['x-roles']).toEqual(['ADMIN']);
    expect(find('post', '/docgia/{id}/tai-khoan')?.['x-roles']).toEqual([
      'ADMIN',
    ]);
    expect(find('post', '/phat/{id}/huy')?.['x-roles']).toEqual(['ADMIN']);
    // Class-level @Roles
    expect(find('get', '/bao-cao/muon-qua-han')?.['x-roles']).toEqual([
      'ADMIN',
      'THU_THU',
    ]);
    // Handler không ghi đè thì dùng @Roles của class (docgia: ADMIN + THU_THU)
    expect(find('patch', '/docgia/{id}')?.['x-roles']).toEqual([
      'ADMIN',
      'THU_THU',
    ]);
    expect(find('post', '/muon-tra/gia-han')?.['x-roles']).toBeUndefined();
  });

  it('mọi $ref trỏ tới schema có thật và khóa BIGINT khai báo là chuỗi', () => {
    const json = JSON.stringify(document);
    const schemas = document.components?.schemas ?? {};
    for (const [, name] of json.matchAll(/#\/components\/schemas\/([\w.]+)/g)) {
      expect(schemas[name], `schema ${name} không tồn tại`).toBeDefined();
    }
    expect(find('get', '/sach/{id}')).toBeTruthy();
    const params = (
      find('get', '/sach/{id}') as unknown as {
        parameters: { name: string; schema: { type: string } }[];
      }
    ).parameters;
    expect(params.find((p) => p.name === 'id')?.schema.type).toBe('string');
  });
});

import 'reflect-metadata';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { IS_PUBLIC_KEY } from './common/decorators/public.decorator.js';
import { ROLES_KEY } from './common/decorators/roles.decorator.js';

const DESCRIPTION = `API quản lý thư viện đại học (đồ án IE103, nhóm 8). Nghiệp vụ nằm trong MySQL (procedure, trigger, view); BE chỉ gọi lại và xác thực.

**Cách dùng nhanh**
1. \`POST /auth/login\` với tài khoản seed (ví dụ \`ad001\` / \`AD001@Nhom8\`), lấy \`accessToken\`.
2. Bấm **Authorize** ở góc phải và dán token (không cần gõ chữ \`Bearer\`). Token được nhớ khi tải lại trang.
3. Mỗi endpoint ghi rõ **Quyền** được gọi. Sai vai trò: 403. Token sai, hết hạn hoặc tài khoản bị khóa: 401.

**Quy ước dữ liệu**
- Khóa chính BIGINT (\`id\`) là **chuỗi**, ví dụ \`"13"\`. Các mã (\`maSach\`, \`maBanSach\`, \`maNguoiDung\`...) là chuỗi và là thứ dùng khi gọi API nghiệp vụ.
- Endpoint danh sách có phân trang trả \`{ data, total, page, limit }\` (\`page\` từ 1, \`limit\` tối đa 100).
- Cột ngày kiểu DATE trả dạng ISO \`YYYY-MM-DDT00:00:00.000Z\`.
- Tiền (VND) từ báo cáo và \`/me\` là number; \`soTien\`/\`giaBia\` đọc từ bảng là chuỗi thập phân (DECIMAL).
- Báo cáo (\`/bao-cao/*\`), \`GET /sach\` và \`/me/*\` giữ tên cột snake_case của view; các endpoint còn lại dùng camelCase.
- Lỗi luôn có dạng \`{ statusCode, message }\`. 422 là lỗi nghiệp vụ do CSDL báo, \`message\` là thông báo cho người dùng (tiếng Việt không dấu).`;

const TAGS: [string, string][] = [
  ['auth', 'Đăng nhập và thông tin tài khoản'],
  ['ban-doc', 'Khu vực "của tôi": dữ liệu của chính tài khoản đang đăng nhập'],
  ['sach', 'Tra cứu sách, quản lý đầu sách và bản sách'],
  ['muon-tra', 'Phiếu mượn, trả sách, gia hạn'],
  ['dat-truoc', 'Đặt trước sách'],
  ['phat', 'Phiếu phạt'],
  ['docgia', 'Quản lý người dùng và tài khoản'],
  ['danh-muc', 'Thể loại, nhà xuất bản, tác giả'],
  ['bao-cao', 'Báo cáo (cán bộ), đọc từ các view của CSDL'],
];

const HTTP_METHODS: Record<number, string> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.DELETE]: 'delete',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.OPTIONS]: 'options',
  [RequestMethod.HEAD]: 'head',
};

const segment = (value: unknown) =>
  String(Array.isArray(value) ? value[0] : (value ?? ''))
    .replace(/^\/+|\/+$/g, '')
    .trim();

/**
 * Ghi "Quyền" vào mô tả từng operation, lấy từ chính metadata mà `RolesGuard`/`JwtAuthGuard` đọc
 * (@Roles, @Public; handler thắng class) nên tài liệu không thể lệch với hành vi thật.
 */
function annotatePermissions(app: INestApplication, document: OpenAPIObject) {
  for (const module of app.get(ModulesContainer).values()) {
    for (const { metatype } of module.controllers.values()) {
      if (!metatype) continue;
      const base = segment(Reflect.getMetadata(PATH_METADATA, metatype));

      for (const name of Object.getOwnPropertyNames(metatype.prototype)) {
        const handler = metatype.prototype[name] as unknown;
        if (typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          number | undefined;
        if (method === undefined || !(method in HTTP_METHODS)) continue;

        const sub = segment(Reflect.getMetadata(PATH_METADATA, handler));
        const path = `/${[base, sub].filter(Boolean).join('/')}`.replace(
          /:(\w+)/g,
          '{$1}',
        );
        const pathItem = document.paths[path] as
          Record<string, Record<string, unknown>> | undefined;
        const operation = pathItem?.[HTTP_METHODS[method]];
        if (!operation) continue;

        const pick = <T>(key: string) =>
          (Reflect.getMetadata(key, handler) ??
            Reflect.getMetadata(key, metatype)) as T | undefined;
        const isPublic = pick<boolean>(IS_PUBLIC_KEY) === true;
        const roles = pick<string[]>(ROLES_KEY);

        let permission: string;
        if (isPublic) {
          permission = 'Công khai, không cần token.';
        } else if (roles?.length) {
          operation['x-roles'] = roles;
          permission = roles.map((role) => `\`${role}\``).join(', ');
        } else {
          permission = 'mọi tài khoản đã đăng nhập.';
        }
        const text = `**Quyền:** ${permission}`;
        operation.description = operation.description
          ? `${operation.description as string}\n\n${text}`
          : text;
      }
    }
  }
}

/** Tham số đường dẫn BIGINT: BE nhận chuỗi số (khớp với `id` dạng chuỗi trong mọi response). */
function describePathIds(document: OpenAPIObject) {
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem) as {
      parameters?: { in?: string; schema?: Record<string, unknown> }[];
    }[]) {
      for (const parameter of operation?.parameters ?? []) {
        if (parameter.in === 'path' && parameter.schema?.format === 'int64') {
          parameter.schema = {
            type: 'string',
            pattern: '^[0-9]+$',
            example: '1',
          };
        }
      }
    }
  }
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('QLTV Nhóm 8 - API quản lý thư viện')
    .setDescription(DESCRIPTION)
    .setVersion('2.2')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
  for (const [name, description] of TAGS) builder.addTag(name, description);

  const document = SwaggerModule.createDocument(app, builder.build(), {
    // Tên hàm sinh code cho FE: Sach_traCuu, MuonTra_giaHan, ...
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
  annotatePermissions(app, document);
  describePathIds(document);
  return document;
}

export function setupSwagger(app: INestApplication) {
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
    customSiteTitle: 'QLTV Nhóm 8 - API',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
    },
  });
}

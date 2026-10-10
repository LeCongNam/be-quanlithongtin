import type { PoolOptions } from 'mysql2/promise';

/** Bỏ số 0 thừa của DECIMAL (`85000.00` -> `85000`, `12.50` -> `12.5`) để JSON giống Decimal của Prisma trước đây. */
export function trimDecimal(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

/**
 * `DATABASE_URL` giữ nguyên dạng `mysql://user:pass@host:port/db?ssl-mode=REQUIRED` (cùng biến môi trường đã cấu
 * hình trên Render) nên tự tách URL; mysql2 không hiểu `ssl-mode`.
 *
 * SSL: `ssl-mode=REQUIRED` chỉ mã hóa đường truyền (không kiểm chứng chứng chỉ); `VERIFY_CA`/`VERIFY_IDENTITY`
 * hoặc có `sslCa` (PEM của CA, vd. CA của Aiven) thì kiểm chứng; `DISABLED` hoặc không khai báo thì không dùng SSL.
 */
export function parseDatabaseUrl(
  databaseUrl: string,
  { sslCa }: { sslCa?: string } = {},
): PoolOptions {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL phải có dạng mysql://...');
  }
  const mode = (
    url.searchParams.get('ssl-mode') ??
    url.searchParams.get('sslmode') ??
    ''
  ).toUpperCase();

  let ssl: PoolOptions['ssl'];
  if (sslCa) {
    ssl = { ca: sslCa, rejectUnauthorized: true };
  } else if (mode === 'VERIFY_CA' || mode === 'VERIFY_IDENTITY') {
    ssl = { rejectUnauthorized: true };
  } else if (mode && mode !== 'DISABLED') {
    ssl = { rejectUnauthorized: false };
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    ssl,
    charset: 'utf8mb4',
    // Không đổi múi giờ: DATE/DATETIME ra Date theo UTC như Prisma, JSON là ISO `2026-10-08T00:00:00.000Z`
    timezone: 'Z',
    // BIGINT (khóa chính, COUNT) luôn là chuỗi -> JSON giống BigInt đã serialize; DECIMAL xử lý ở typeCast
    supportBigNumbers: true,
    bigNumberStrings: true,
    typeCast(field, next) {
      if (field.type === 'NEWDECIMAL' || field.type === 'DECIMAL') {
        const value = field.string();
        return value === null ? null : trimDecimal(value);
      }
      return next();
    },
    connectionLimit: 10,
    waitForConnections: true,
    // Render/Aiven gói free cắt kết nối rảnh: giữ sống và bỏ connection rảnh lâu để không dùng phải connection chết
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    maxIdle: 5,
    idleTimeout: 60_000,
  };
}

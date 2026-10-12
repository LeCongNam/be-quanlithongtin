import { existsSync } from 'node:fs';

/**
 * E2E ghi dữ liệu thật (phiếu mượn/phạt có khóa ngoại nên không dọn được), vì vậy chỉ cho chạy trên DB local.
 * Cần chạy trên DB khác (đã cô lập, dùng một lần): đặt E2E_ALLOW_REMOTE_DB=1.
 */
if (!process.env.DATABASE_URL && existsSync('.env')) {
  process.loadEnvFile('.env'); // cùng nguồn với ConfigModule.forRoot()
}

const url = process.env.DATABASE_URL;
const host = url ? new URL(url).hostname.replace(/^\[|\]$/g, '') : '';
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);

if (url && !isLocal && process.env.E2E_ALLOW_REMOTE_DB !== '1') {
  throw new Error(
    `E2E từ chối chạy: DATABASE_URL trỏ tới "${host}" (không phải DB local) và test sẽ ghi dữ liệu vào đó. ` +
      'Dùng DB docker local, hoặc đặt E2E_ALLOW_REMOTE_DB=1 nếu chắc chắn đó là DB test dùng một lần.',
  );
}

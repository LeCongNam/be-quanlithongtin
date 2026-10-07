import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Định dạng mật khẩu duy nhất của hệ thống: SHA2(CONCAT(muoi, mat_khau), 256) dạng hex thường,
 * giống hệt điều kiện trong sp_dang_nhap (sql/04_procedures.sql). BE và CSDL phải cùng công thức
 * để tài khoản tạo/đăng nhập qua web vẫn đăng nhập được ở tầng CSDL.
 */
export function hashMatKhau(muoi: string, matKhau: string): string {
  return createHash('sha256')
    .update(muoi + matKhau, 'utf8')
    .digest('hex');
}

export function khopMatKhau(
  muoi: string,
  matKhau: string,
  matKhauHash: string,
): boolean {
  const expected = Buffer.from(matKhauHash.toLowerCase());
  const actual = Buffer.from(hashMatKhau(muoi, matKhau));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

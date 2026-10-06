import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { resolveMaNguoiDung } from './auth-helpers.js';
import { VaiTroTaiKhoan } from './db-enums.js';

const user = (vaiTro: VaiTroTaiKhoan) => ({
  nguoiDungId: '1',
  maNguoiDung: 'SV001',
  tenDangNhap: 'sv001',
  vaiTro,
});

describe('resolveMaNguoiDung', () => {
  it('bạn đọc luôn dùng mã trong token', () => {
    expect(resolveMaNguoiDung(user(VaiTroTaiKhoan.BAN_DOC))).toBe('SV001');
    expect(resolveMaNguoiDung(user(VaiTroTaiKhoan.BAN_DOC), 'SV001')).toBe(
      'SV001',
    );
  });

  it('bạn đọc không thao tác hộ người khác', () => {
    expect(() =>
      resolveMaNguoiDung(user(VaiTroTaiKhoan.BAN_DOC), 'SV002'),
    ).toThrow(ForbiddenException);
  });

  it('thủ thư phải nêu rõ người dùng', () => {
    expect(resolveMaNguoiDung(user(VaiTroTaiKhoan.THU_THU), 'SV002')).toBe(
      'SV002',
    );
    expect(() => resolveMaNguoiDung(user(VaiTroTaiKhoan.THU_THU))).toThrow(
      BadRequestException,
    );
  });
});

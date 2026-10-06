import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthUser } from './decorators/current-user.decorator.js';
import { VaiTroTaiKhoan } from './db-enums.js';

export const STAFF_ROLES = [VaiTroTaiKhoan.ADMIN, VaiTroTaiKhoan.THU_THU];

export function isStaff(user: AuthUser) {
  return STAFF_ROLES.includes(user.vaiTro);
}

/**
 * Bạn đọc dùng chung một user MySQL nên DB không biết ai gọi: BE phải ép mã người dùng
 * theo token. Bạn đọc chỉ thao tác cho chính mình; thủ thư/admin phải nêu rõ người dùng.
 */
export function resolveMaNguoiDung(user: AuthUser, requested?: string): string {
  if (!isStaff(user)) {
    if (requested && requested !== user.maNguoiDung) {
      throw new ForbiddenException('Chi duoc thao tac cho tai khoan cua minh');
    }
    return user.maNguoiDung;
  }
  if (!requested) throw new BadRequestException('Thieu maNguoiDung');
  return requested;
}

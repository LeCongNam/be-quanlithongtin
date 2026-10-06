import { SetMetadata } from '@nestjs/common';
import { VaiTroTaiKhoan } from '../db-enums.js';

export const ROLES_KEY = 'roles';

/** Giới hạn route cho các vai trò (tai_khoan.vai_tro). Không gắn thì chỉ cần đăng nhập. */
export const Roles = (...roles: VaiTroTaiKhoan[]) =>
  SetMetadata(ROLES_KEY, roles);

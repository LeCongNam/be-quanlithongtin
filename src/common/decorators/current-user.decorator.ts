import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { VaiTroTaiKhoan } from '../db-enums.js';

export interface AuthUser {
  /** nguoi_dung.id (BIGINT dạng chuỗi) - dùng làm mã người dùng khi gọi sp_* */
  nguoiDungId: string;
  maNguoiDung: string;
  tenDangNhap: string;
  vaiTro: VaiTroTaiKhoan;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
  },
);

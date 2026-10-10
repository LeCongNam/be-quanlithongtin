import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { DbService } from '../../database/db.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthUser } from '../decorators/current-user.decorator.js';
import { TrangThaiNguoiDung, TrangThaiTaiKhoan } from '../db-enums.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly db: DbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Thiếu token đăng nhập');
    }

    let user: AuthUser;
    try {
      user = await this.jwtService.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }

    // Token còn hạn nhưng tài khoản/người dùng có thể đã bị khóa sau khi cấp: kiểm tra DB mỗi request.
    const taiKhoan = await this.db.queryOne<{
      trang_thai: string;
      nguoi_dung_trang_thai: string;
    }>(
      `SELECT tk.trang_thai, nd.trang_thai AS nguoi_dung_trang_thai
       FROM tai_khoan tk
       JOIN nguoi_dung nd ON nd.id = tk.nguoi_dung_id
       WHERE tk.nguoi_dung_id = ?`,
      [BigInt(user.nguoiDungId)],
    );
    if (
      taiKhoan?.trang_thai !== TrangThaiTaiKhoan.HOAT_DONG ||
      taiKhoan.nguoi_dung_trang_thai !== TrangThaiNguoiDung.HOAT_DONG
    ) {
      throw new UnauthorizedException(
        'Tai khoan dang bi khoa hoac ngung hoat dong',
      );
    }

    request.user = user;
    return true;
  }
}

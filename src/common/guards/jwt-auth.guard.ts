import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthUser } from '../decorators/current-user.decorator.js';
import { TrangThaiNguoiDung, TrangThaiTaiKhoan } from '../db-enums.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
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
      throw new UnauthorizedException('Thieu token dang nhap');
    }

    let user: AuthUser;
    try {
      user = await this.jwtService.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('Token khong hop le hoac da het han');
    }

    // Token còn hạn nhưng tài khoản/người dùng có thể đã bị khóa sau khi cấp: kiểm tra DB mỗi request.
    const taiKhoan = await this.prisma.taiKhoan.findUnique({
      where: { nguoiDungId: BigInt(user.nguoiDungId) },
      select: { trangThai: true, nguoiDung: { select: { trangThai: true } } },
    });
    if (
      taiKhoan?.trangThai !== TrangThaiTaiKhoan.HOAT_DONG ||
      taiKhoan.nguoiDung.trangThai !== TrangThaiNguoiDung.HOAT_DONG
    ) {
      throw new UnauthorizedException(
        'Tai khoan dang bi khoa hoac ngung hoat dong',
      );
    }

    request.user = user;
    return true;
  }
}

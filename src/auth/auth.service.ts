import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import {
  TrangThaiNguoiDung,
  TrangThaiTaiKhoan,
  VaiTroTaiKhoan,
} from '../common/db-enums.js';
import { hashMatKhau, khopMatKhau } from '../common/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login({ tenDangNhap, matKhau }: LoginDto) {
    const taiKhoan = await this.prisma.taiKhoan.findUnique({
      where: { tenDangNhap },
      include: { nguoiDung: true },
    });

    // Cùng một thông báo cho sai tên đăng nhập/mật khẩu để không lộ tài khoản có tồn tại hay không.
    if (!taiKhoan || !(await this.verifyPassword(matKhau, taiKhoan))) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    if (
      taiKhoan.trangThai !== TrangThaiTaiKhoan.HOAT_DONG ||
      taiKhoan.nguoiDung.trangThai !== TrangThaiNguoiDung.HOAT_DONG
    ) {
      throw new UnauthorizedException(
        'Tai khoan dang bi khoa hoac ngung hoat dong',
      );
    }

    const user: AuthUser = {
      nguoiDungId: taiKhoan.nguoiDungId.toString(),
      maNguoiDung: taiKhoan.nguoiDung.maNguoiDung,
      tenDangNhap: taiKhoan.tenDangNhap,
      vaiTro: taiKhoan.vaiTro as VaiTroTaiKhoan,
    };

    return {
      accessToken: await this.jwtService.signAsync(user),
      user: { ...user, hoTen: taiKhoan.nguoiDung.hoTen },
    };
  }

  /**
   * Định dạng chuẩn là SHA2(muoi + mat_khau) như sp_dang_nhap (xem common/password.ts).
   * Hash bcrypt chỉ còn là di sản của các phiên bản BE cũ: đăng nhập đúng thì ghi lại về SHA2
   * để tài khoản đó dùng được ở tầng CSDL.
   */
  private async verifyPassword(
    matKhau: string,
    taiKhoan: { id: bigint; muoi: string; matKhauHash: string },
  ): Promise<boolean> {
    if (!taiKhoan.matKhauHash.startsWith('$2')) {
      return khopMatKhau(taiKhoan.muoi, matKhau, taiKhoan.matKhauHash);
    }

    if (!(await bcrypt.compare(matKhau, taiKhoan.matKhauHash))) return false;
    await this.prisma.taiKhoan.update({
      where: { id: taiKhoan.id },
      data: { matKhauHash: hashMatKhau(taiKhoan.muoi, matKhau) },
    });
    return true;
  }
}

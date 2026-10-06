import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import {
  TrangThaiNguoiDung,
  TrangThaiTaiKhoan,
  VaiTroTaiKhoan,
} from '../common/db-enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';

const BCRYPT_ROUNDS = 10;

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
      throw new UnauthorizedException('Ten dang nhap hoac mat khau khong dung');
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
   * Mật khẩu mới băm bằng bcrypt. Tài khoản seed trong DB dùng SHA2(muoi + mat_khau);
   * đăng nhập đúng bằng kiểu cũ thì băm lại sang bcrypt.
   */
  private async verifyPassword(
    matKhau: string,
    taiKhoan: { id: bigint; muoi: string; matKhauHash: string },
  ): Promise<boolean> {
    if (taiKhoan.matKhauHash.startsWith('$2')) {
      return bcrypt.compare(matKhau, taiKhoan.matKhauHash);
    }

    const legacy = createHash('sha256')
      .update(taiKhoan.muoi + matKhau)
      .digest('hex');
    const expected = Buffer.from(taiKhoan.matKhauHash.toLowerCase());
    const actual = Buffer.from(legacy);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return false;

    await this.prisma.taiKhoan.update({
      where: { id: taiKhoan.id },
      data: { matKhauHash: await bcrypt.hash(matKhau, BCRYPT_ROUNDS) },
    });
    return true;
  }
}

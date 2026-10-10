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
import { DbService } from '../database/db.service.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly jwtService: JwtService,
  ) {}

  async login({ tenDangNhap, matKhau }: LoginDto) {
    const taiKhoan = await this.db.queryOne<{
      id: string;
      nguoi_dung_id: string;
      ten_dang_nhap: string;
      muoi: string;
      mat_khau_hash: string;
      vai_tro: string;
      trang_thai: string;
      ma_nguoi_dung: string;
      ho_ten: string;
      nguoi_dung_trang_thai: string;
    }>(
      `SELECT tk.id, tk.nguoi_dung_id, tk.ten_dang_nhap, tk.muoi, tk.mat_khau_hash, tk.vai_tro, tk.trang_thai,
              nd.ma_nguoi_dung, nd.ho_ten, nd.trang_thai AS nguoi_dung_trang_thai
       FROM tai_khoan tk
       JOIN nguoi_dung nd ON nd.id = tk.nguoi_dung_id
       WHERE tk.ten_dang_nhap = ?`,
      [tenDangNhap],
    );

    // Cùng một thông báo cho sai tên đăng nhập/mật khẩu để không lộ tài khoản có tồn tại hay không.
    if (!taiKhoan || !(await this.verifyPassword(matKhau, taiKhoan))) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    if (
      taiKhoan.trang_thai !== TrangThaiTaiKhoan.HOAT_DONG ||
      taiKhoan.nguoi_dung_trang_thai !== TrangThaiNguoiDung.HOAT_DONG
    ) {
      throw new UnauthorizedException(
        'Tai khoan dang bi khoa hoac ngung hoat dong',
      );
    }

    const user: AuthUser = {
      nguoiDungId: taiKhoan.nguoi_dung_id,
      maNguoiDung: taiKhoan.ma_nguoi_dung,
      tenDangNhap: taiKhoan.ten_dang_nhap,
      vaiTro: taiKhoan.vai_tro as VaiTroTaiKhoan,
    };

    return {
      accessToken: await this.jwtService.signAsync(user),
      user: { ...user, hoTen: taiKhoan.ho_ten },
    };
  }

  /**
   * Định dạng chuẩn là SHA2(muoi + mat_khau) như sp_dang_nhap (xem common/password.ts).
   * Hash bcrypt chỉ còn là di sản của các phiên bản BE cũ: đăng nhập đúng thì ghi lại về SHA2
   * để tài khoản đó dùng được ở tầng CSDL.
   */
  private async verifyPassword(
    matKhau: string,
    taiKhoan: { id: string; muoi: string; mat_khau_hash: string },
  ): Promise<boolean> {
    if (!taiKhoan.mat_khau_hash.startsWith('$2')) {
      return khopMatKhau(taiKhoan.muoi, matKhau, taiKhoan.mat_khau_hash);
    }

    if (!(await bcrypt.compare(matKhau, taiKhoan.mat_khau_hash))) return false;
    await this.db.execute(
      'UPDATE tai_khoan SET mat_khau_hash = ? WHERE id = ?',
      [hashMatKhau(taiKhoan.muoi, matKhau), taiKhoan.id],
    );
    return true;
  }
}

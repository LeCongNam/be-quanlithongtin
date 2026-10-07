import { ApiProperty } from '@nestjs/swagger';
import {
  LoaiNguoiDung,
  TrangThaiNguoiDung,
  TrangThaiTaiKhoan,
  VaiTroTaiKhoan,
} from '../../common/db-enums.js';
import { ApiBigInt, ApiEnum } from '../../common/swagger/api-types.js';

/** Người dùng rút gọn, lồng trong phiếu mượn/phạt/đặt trước. */
export class NguoiDungTomTatDto {
  @ApiProperty({ example: 'SV001' })
  maNguoiDung!: string;
  @ApiProperty({ example: 'Võ Hoàng Nhiên' })
  hoTen!: string;
}

/** Tài khoản đăng nhập, không bao giờ có `muoi`/`matKhauHash`. */
export class TaiKhoanCongKhaiDto {
  @ApiProperty({ example: 'sv001' })
  tenDangNhap!: string;
  @ApiEnum(VaiTroTaiKhoan, 'VaiTroTaiKhoan')
  vaiTro!: VaiTroTaiKhoan;
  @ApiEnum(TrangThaiTaiKhoan, 'TrangThaiTaiKhoan')
  trangThai!: TrangThaiTaiKhoan;
}

export class NguoiDungDto {
  @ApiBigInt()
  id!: string;
  @ApiProperty({ example: 'SV001' })
  maNguoiDung!: string;
  @ApiProperty()
  hoTen!: string;
  @ApiEnum(LoaiNguoiDung, 'LoaiNguoiDung')
  loaiNguoiDung!: LoaiNguoiDung;
  @ApiProperty({ nullable: true })
  email!: string | null;
  @ApiProperty({ nullable: true })
  sdt!: string | null;
  @ApiProperty({ nullable: true })
  khoaDonVi!: string | null;
  @ApiEnum(TrangThaiNguoiDung, 'TrangThaiNguoiDung')
  trangThai!: TrangThaiNguoiDung;
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class NguoiDungChiTietDto extends NguoiDungDto {
  @ApiProperty({
    type: TaiKhoanCongKhaiDto,
    nullable: true,
    description: 'null nếu chưa có tài khoản đăng nhập',
  })
  taiKhoan!: TaiKhoanCongKhaiDto | null;
}

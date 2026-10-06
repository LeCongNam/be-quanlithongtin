import { IsEnum } from 'class-validator';
import {
  TrangThaiNguoiDung,
  TrangThaiTaiKhoan,
} from '../../common/db-enums.js';

export class DoiTrangThaiNguoiDungDto {
  @IsEnum(TrangThaiNguoiDung)
  trangThai!: TrangThaiNguoiDung;
}

export class DoiTrangThaiTaiKhoanDto {
  @IsEnum(TrangThaiTaiKhoan)
  trangThai!: TrangThaiTaiKhoan;
}

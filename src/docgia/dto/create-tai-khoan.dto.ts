import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VaiTroTaiKhoan } from '../../common/db-enums.js';

export class CreateTaiKhoanDto {
  /** Mặc định: mã người dùng viết thường (như dữ liệu seed). */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  tenDangNhap?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // giới hạn của bcrypt
  matKhau!: string;

  /** Mặc định: CAN_BO -> THU_THU, SINH_VIEN/GIANG_VIEN -> BAN_DOC. DB (trigger) bắt buộc vai trò khớp loại người dùng. */
  @IsOptional()
  @IsEnum(VaiTroTaiKhoan)
  vaiTro?: VaiTroTaiKhoan;
}

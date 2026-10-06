import { LoaiNguoiDung } from '../../common/db-enums.js';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Người mới luôn HOAT_DONG; đổi trạng thái qua PATCH /docgia/:id/trang-thai. */
export class CreateDocgiaDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maNguoiDung!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  hoTen!: string;

  @IsEnum(LoaiNguoiDung)
  loaiNguoiDung!: LoaiNguoiDung;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf(
    (_object, value) => value !== undefined && value !== null && value !== '',
  )
  @IsString()
  @MaxLength(120)
  @IsEmail()
  email?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sdt?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  khoaDonVi?: string;
}

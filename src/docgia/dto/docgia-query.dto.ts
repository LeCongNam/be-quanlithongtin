import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/dto/page-query.dto.js';
import { LoaiNguoiDung, TrangThaiNguoiDung } from '../../common/db-enums.js';

export class ListDocgiaQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(160)
  tuKhoa?: string;

  @IsOptional()
  @IsEnum(LoaiNguoiDung)
  loaiNguoiDung?: LoaiNguoiDung;

  @IsOptional()
  @IsEnum(TrangThaiNguoiDung)
  trangThai?: TrangThaiNguoiDung;
}

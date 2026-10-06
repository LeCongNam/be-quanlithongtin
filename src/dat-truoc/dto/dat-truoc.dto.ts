import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/page-query.dto.js';
import { TrangThaiDatTruoc } from '../../common/db-enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DatTruocDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maSach!: string;

  /** Bạn đọc bỏ trống (lấy từ token). Thủ thư/admin đặt hộ thì bắt buộc. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  maNguoiDung?: string;
}

export class HuyDatTruocQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  maNguoiDung?: string;
}

export class ListDatTruocQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(TrangThaiDatTruoc)
  trangThai?: TrangThaiDatTruoc;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  maNguoiDung?: string;
}

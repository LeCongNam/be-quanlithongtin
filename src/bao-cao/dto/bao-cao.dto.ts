import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TrangThaiDatTruoc } from '../../common/db-enums.js';

export class TopSachQueryDto {
  /** Số sách trả về (1–100). */
  @ApiPropertyOptional({
    type: 'integer',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}

export class NguoiDungQueryDto {
  /** Lọc theo mã người dùng (bỏ trống = tất cả). */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  maNguoiDung?: string;
}

export class DatTruocQueryDto extends NguoiDungQueryDto {
  /** Lọc theo trạng thái lượt đặt (bỏ trống = tất cả). */
  @IsOptional()
  @IsEnum(TrangThaiDatTruoc)
  trangThai?: TrangThaiDatTruoc;
}

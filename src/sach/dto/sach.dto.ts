import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TinhTrangBanSach } from '../../common/db-enums.js';
import { PageQueryDto } from '../../common/dto/page-query.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSachDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maSach!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  tenSach!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maTheLoai!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maNxb!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  namXuatBan?: number;

  /** Phải thuộc danh sách CHECK trong DB (Tiếng Việt, English, ...). */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ngonNgu?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  giaBia?: number;

  @IsOptional()
  @IsString()
  moTa?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Matches(/^[^,]+$/, {
    each: true,
    message: 'maTacGias khong duoc chua dau phay',
  })
  @MaxLength(20, { each: true })
  maTacGias?: string[];
}

export class UpdateSachDto extends PartialType(CreateSachDto) {}

export class TraCuuSachQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  tuKhoa?: string;
}

/** Nhập bản sách qua sp_them_ban_sach: mã BSnnn tự sinh, ngày nhập = hôm nay. */
export class CreateBanSachDto {
  /** Số bản nhập (1–100), mặc định 1. */
  @ApiPropertyOptional({
    type: 'integer',
    default: 1,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  soBan: number = 1;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  viTriKe!: string;
}

export class CapNhatTinhTrangBanSachDto {
  /** Tình trạng đích; DB kiểm tra chuyển trạng thái có hợp lệ không. */
  @ApiProperty({ enum: TinhTrangBanSach, enumName: 'TinhTrangBanSach' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  tinhTrang!: string;
}

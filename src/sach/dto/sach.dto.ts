import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
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

  @Type(() => Number)
  @IsInt()
  @Min(1)
  theLoaiId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  nxbId!: number;

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
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  tacGiaIds?: number[];
}

export class UpdateSachDto extends PartialType(CreateSachDto) {}

export class TraCuuSachQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  tuKhoa?: string;
}

export class CreateBanSachDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  maBanSach!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  viTriKe!: string;

  /** yyyy-mm-dd */
  @IsString()
  @IsNotEmpty()
  ngayNhap!: string;
}

export class CapNhatTinhTrangBanSachDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  tinhTrang!: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/page-query.dto.js';
import { TinhTrangTra, TrangThaiPhieuMuon } from '../../common/db-enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class TaoPhieuMuonDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maNguoiDung!: string;

  /** Tối đa 5 là mức mặc định (tham_so SO_SACH_TOI_DA); DB mới là nơi quyết định. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  maBanSachs!: string[];
}

export class TraSachDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  maBanSach!: string;

  /** Tình trạng sách khi trả; HU_HONG/MAT sinh phiếu phạt. Mặc định BINH_THUONG. */
  @ApiPropertyOptional({
    enum: TinhTrangTra,
    enumName: 'TinhTrangTra',
    default: TinhTrangTra.BINH_THUONG,
  })
  @IsEnum(TinhTrangTra)
  tinhTrang: TinhTrangTra = TinhTrangTra.BINH_THUONG;
}

export class GiaHanDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  maBanSach!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  soNgay!: number;
}

export class ListPhieuMuonQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(TrangThaiPhieuMuon)
  trangThai?: TrangThaiPhieuMuon;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  maNguoiDung?: string;
}

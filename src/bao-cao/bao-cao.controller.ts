import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
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
import { STAFF_ROLES } from '../common/auth-helpers.js';
import { TrangThaiDatTruoc } from '../common/db-enums.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

class TopSachQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}

class NguoiDungQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  maNguoiDung?: string;
}

class DatTruocQueryDto extends NguoiDungQueryDto {
  @IsOptional()
  @IsEnum(TrangThaiDatTruoc)
  trangThai?: TrangThaiDatTruoc;
}

const where = (conds: Prisma.Sql[]) =>
  conds.length
    ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}`
    : Prisma.empty;

/**
 * Báo cáo cho cán bộ, đọc từ các view vw_* trong DB (kết quả giữ nguyên tên cột snake_case của view).
 * vw_tra_cuu_sach dùng ở GET /sach.
 */
@ApiTags('bao-cao')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller('bao-cao')
export class BaoCaoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('danh-muc-sach')
  danhMucSach() {
    return this.prisma.$queryRaw<
      unknown[]
    >`SELECT * FROM vw_danh_muc_sach ORDER BY ten_sach`;
  }

  @Get('sach-dang-muon')
  sachDangMuon() {
    return this.prisma.$queryRaw<
      unknown[]
    >`SELECT * FROM vw_sach_dang_muon ORDER BY han_tra`;
  }

  @Get('muon-qua-han')
  muonQuaHan() {
    return this.prisma.$queryRaw<
      unknown[]
    >`SELECT * FROM vw_muon_qua_han ORDER BY so_ngay_qua_han DESC`;
  }

  @Get('nguoi-dung-vi-pham')
  nguoiDungViPham() {
    return this.prisma.$queryRaw<
      unknown[]
    >`SELECT * FROM vw_nguoi_dung_vi_pham`;
  }

  @Get('top-sach-muon-nhieu')
  topSachMuonNhieu(@Query() { limit }: TopSachQueryDto) {
    return this.prisma.$queryRaw<
      unknown[]
    >`SELECT * FROM vw_top_sach_muon_nhieu ORDER BY so_luot_muon DESC LIMIT ${limit}`;
  }

  /** Theo tháng × loại phạt: số phiếu, tổng tiền, đã thu, còn nợ; phiếu HUY đếm riêng. */
  @Get('thong-ke-tien-phat')
  thongKeTienPhat() {
    return this.prisma.$queryRaw<
      unknown[]
    >`SELECT * FROM vw_thong_ke_tien_phat ORDER BY thang DESC, loai_phat`;
  }

  @Get('lich-su-muon')
  lichSuMuon(@Query() { maNguoiDung }: NguoiDungQueryDto) {
    const conds = maNguoiDung
      ? [Prisma.sql`ma_nguoi_dung = ${maNguoiDung}`]
      : [];
    return this.prisma.$queryRaw<unknown[]>`
      SELECT * FROM vw_lich_su_muon ${where(conds)}
      ORDER BY ngay_muon DESC, ma_phieu DESC, ma_ban_sach`;
  }

  /** thu_tu_cho: vị trí trong hàng đợi (chỉ lượt CHO_XU_LY của người đang HOAT_DONG). */
  @Get('dat-truoc')
  datTruoc(@Query() { maNguoiDung, trangThai }: DatTruocQueryDto) {
    const conds: Prisma.Sql[] = [];
    if (maNguoiDung) conds.push(Prisma.sql`ma_nguoi_dung = ${maNguoiDung}`);
    if (trangThai) conds.push(Prisma.sql`trang_thai = ${trangThai}`);
    return this.prisma.$queryRaw<unknown[]>`
      SELECT * FROM vw_dat_truoc ${where(conds)}
      ORDER BY ma_sach, trang_thai, thu_tu_cho, ngay_dat`;
  }
}

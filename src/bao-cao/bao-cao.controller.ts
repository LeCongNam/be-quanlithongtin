import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { STAFF_ROLES } from '../common/auth-helpers.js';
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

/** Báo cáo đọc từ 6 view vw_* trong DB (kết quả giữ nguyên tên cột snake_case của view). */
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
}

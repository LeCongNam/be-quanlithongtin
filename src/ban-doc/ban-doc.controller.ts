import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Row = Record<string, unknown>;

/** Ép cột đếm (BIGINT/DECIMAL từ view) sang number như namedRows. */
const toNumber = (rows: Row[], cols: string[]) =>
  rows.map((r) => {
    for (const c of cols) if (r[c] != null) r[c] = Number(r[c]);
    return r;
  });

/**
 * Khu vực "của tôi": luôn dùng mã người dùng trong token, không nhận tham số từ client.
 * Các sp_bandoc_* trong DB nhận token phiên của DB (sp_dang_nhap); BE tự xác thực bằng JWT nên đọc thẳng
 * cùng view/cột như các procedure đó, lọc theo maNguoiDung của JWT.
 */
@ApiTags('ban-doc')
@ApiBearerAuth()
@Controller('me')
export class BanDocController {
  constructor(private readonly prisma: PrismaService) {}

  /** = sp_bandoc_sach_dang_muon */
  @Get('sach-dang-muon')
  async sachDangMuon(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT ma_phieu, ma_ban_sach, ma_sach, ten_sach, ngay_muon, han_tra, so_ngay_qua_han
      FROM vw_sach_dang_muon
      WHERE ma_nguoi_dung = ${user.maNguoiDung}
      ORDER BY han_tra`;
    return toNumber(rows, ['so_ngay_qua_han']);
  }

  /** = sp_bandoc_tien_phat */
  @Get('tien-phat')
  tienPhat(@CurrentUser() user: AuthUser) {
    return this.prisma.$queryRaw<Row[]>`
      SELECT pp.id AS ma_phieu_phat, pp.loai_phat, pp.so_tien, pp.ly_do, pp.trang_thai, pp.ngay_tao, pp.ngay_thanh_toan
      FROM phieu_phat pp
      JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
      JOIN phieu_muon p ON p.id = c.phieu_muon_id
      JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
      WHERE nd.ma_nguoi_dung = ${user.maNguoiDung}
      ORDER BY pp.ngay_tao DESC, pp.id DESC`;
  }

  /** = sp_bandoc_lich_su_muon: cả lượt đang mượn và đã trả, mới nhất trước */
  @Get('lich-su-muon')
  async lichSuMuon(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT ma_phieu, ma_ban_sach, ma_sach, ten_sach, ngay_muon, han_tra, ngay_tra, so_lan_gia_han, tinh_trang_tra,
             so_ngay_qua_han
      FROM vw_lich_su_muon
      WHERE ma_nguoi_dung = ${user.maNguoiDung}
      ORDER BY ngay_muon DESC, ma_phieu DESC, ma_ban_sach`;
    return toNumber(rows, ['so_lan_gia_han', 'so_ngay_qua_han']);
  }

  /** = sp_bandoc_ds_dat_truoc: lượt đang hoạt động trước (thứ tự chờ, bản đang giữ, hạn giữ), rồi lượt cũ */
  @Get('dat-truoc')
  async datTruoc(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT ma_sach, ten_sach, ngay_dat, trang_thai, thu_tu_cho, ma_ban_sach, han_giu
      FROM vw_dat_truoc
      WHERE ma_nguoi_dung = ${user.maNguoiDung}
      ORDER BY trang_thai IN ('CHO_XU_LY', 'SAN_SANG_NHAN') DESC, ngay_dat DESC`;
    return toNumber(rows, ['thu_tu_cho']);
  }
}

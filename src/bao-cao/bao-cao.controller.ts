import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { STAFF_ROLES } from '../common/auth-helpers.js';
import { numberColumns } from '../common/call-rows.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ApiErrors } from '../common/swagger/api-errors.decorator.js';
import { DbService } from '../database/db.service.js';
import { sql, where } from '../database/sql.js';
import type { SqlFragment } from '../database/sql.js';
import {
  DatTruocQueryDto,
  NguoiDungQueryDto,
  TopSachQueryDto,
} from './dto/bao-cao.dto.js';
import {
  DanhMucSachDong,
  DatTruocDong,
  LichSuMuonDong,
  MuonQuaHanDong,
  NguoiDungViPhamDong,
  SachDangMuonDong,
  ThongKeTienPhatDong,
  TopSachMuonNhieuDong,
} from './dto/bao-cao.response.dto.js';

/**
 * Báo cáo cho cán bộ, đọc từ các view vw_* trong DB (kết quả giữ nguyên tên cột snake_case của view;
 * cột đếm/tiền được ép về number). vw_tra_cuu_sach dùng ở GET /sach.
 */
@ApiTags('bao-cao')
@ApiBearerAuth()
@ApiErrors(400, 401, 403)
@Roles(...STAFF_ROLES)
@Controller('bao-cao')
export class BaoCaoController {
  constructor(private readonly db: DbService) {}

  @Get('danh-muc-sach')
  @ApiOperation({
    summary: 'Báo cáo 1: danh mục sách và số bản sẵn sàng',
    description: 'View `vw_danh_muc_sach`; không tính bản MAT/NGUNG_PHUC_VU.',
  })
  @ApiOkResponse({ type: [DanhMucSachDong] })
  async danhMucSach() {
    const rows = await this.db.query(
      sql`SELECT * FROM vw_danh_muc_sach ORDER BY ten_sach, ma_sach`,
    );
    return numberColumns(rows, ['tong_so_ban', 'so_ban_san_sang']);
  }

  @Get('sach-dang-muon')
  @ApiOperation({
    summary: 'Báo cáo 2: sách đang được mượn',
    description: 'View `vw_sach_dang_muon`, sắp theo hạn trả.',
  })
  @ApiOkResponse({ type: [SachDangMuonDong] })
  async sachDangMuon() {
    const rows = await this.db.query(
      sql`SELECT * FROM vw_sach_dang_muon ORDER BY han_tra, ma_phieu, ma_ban_sach`,
    );
    return numberColumns(rows, ['so_ngay_qua_han']);
  }

  @Get('muon-qua-han')
  @ApiOperation({
    summary: 'Báo cáo 3: mượn quá hạn kèm tiền phạt tạm tính',
    description: 'View `vw_muon_qua_han`, quá hạn nhiều nhất trước.',
  })
  @ApiOkResponse({ type: [MuonQuaHanDong] })
  async muonQuaHan() {
    const rows = await this.db.query(
      sql`SELECT * FROM vw_muon_qua_han ORDER BY so_ngay_qua_han DESC, ma_phieu, ten_sach`,
    );
    return numberColumns(rows, ['so_ngay_qua_han', 'tien_phat_tam_tinh']);
  }

  @Get('nguoi-dung-vi-pham')
  @ApiOperation({
    summary: 'Báo cáo 4: người dùng vi phạm / phát sinh tiền phạt',
    description:
      'View `vw_nguoi_dung_vi_pham`, gồm cả người đang giữ sách quá hạn chưa bị lập phiếu phạt. Sắp theo còn nợ giảm dần, rồi tiền phạt tạm tính giảm dần.',
  })
  @ApiOkResponse({ type: [NguoiDungViPhamDong] })
  async nguoiDungViPham() {
    const rows = await this.db.query(
      sql`SELECT * FROM vw_nguoi_dung_vi_pham ORDER BY con_no DESC, tien_phat_tam_tinh DESC, ma_nguoi_dung`,
    );
    return numberColumns(rows, [
      'so_lan_phat',
      'tong_tien_phat',
      'con_no',
      'so_sach_dang_qua_han',
      'tien_phat_tam_tinh',
    ]);
  }

  @Get('top-sach-muon-nhieu')
  @ApiOperation({
    summary: 'Báo cáo 5: top sách được mượn nhiều',
    description:
      'View `vw_top_sach_muon_nhieu`; `limit` mặc định 10, tối đa 100.',
  })
  @ApiOkResponse({ type: [TopSachMuonNhieuDong] })
  async topSachMuonNhieu(@Query() { limit }: TopSachQueryDto) {
    const rows = await this.db.query(
      sql`SELECT * FROM vw_top_sach_muon_nhieu ORDER BY so_luot_muon DESC, ma_sach LIMIT ${limit}`,
    );
    return numberColumns(rows, ['so_luot_muon']);
  }

  /** Theo tháng × loại phạt: số phiếu, tổng tiền, đã thu, còn nợ; phiếu HUY đếm riêng. */
  @Get('thong-ke-tien-phat')
  @ApiOperation({
    summary: 'Báo cáo 6: thống kê tiền phạt theo tháng và loại phạt',
    description:
      'View `vw_thong_ke_tien_phat`; phiếu `HUY` không tính vào tiền, đếm riêng ở `so_phieu_huy`.',
  })
  @ApiOkResponse({ type: [ThongKeTienPhatDong] })
  async thongKeTienPhat() {
    const rows = await this.db.query(
      sql`SELECT * FROM vw_thong_ke_tien_phat ORDER BY thang DESC, loai_phat`,
    );
    return numberColumns(rows, [
      'so_phieu',
      'tong_tien',
      'da_thanh_toan',
      'chua_thanh_toan',
      'so_phieu_huy',
    ]);
  }

  @Get('lich-su-muon')
  @ApiOperation({
    summary: 'Báo cáo 7: lịch sử mượn (lọc theo người dùng)',
    description:
      'View `vw_lich_su_muon`, gồm cả lượt đang mượn và đã trả; bỏ `maNguoiDung` để xem tất cả.',
  })
  @ApiOkResponse({ type: [LichSuMuonDong] })
  async lichSuMuon(@Query() { maNguoiDung }: NguoiDungQueryDto) {
    const conds = maNguoiDung ? [sql`ma_nguoi_dung = ${maNguoiDung}`] : [];
    const rows = await this.db.query(sql`
      SELECT * FROM vw_lich_su_muon ${where(conds)}
      ORDER BY ngay_muon DESC, ma_phieu DESC, ma_ban_sach`);
    return numberColumns(rows, ['so_lan_gia_han', 'so_ngay_qua_han']);
  }

  /** thu_tu_cho: vị trí trong hàng đợi (chỉ lượt CHO_XU_LY của người đang HOAT_DONG). */
  @Get('dat-truoc')
  @ApiOperation({
    summary: 'Báo cáo 8: đặt trước và thứ tự hàng chờ',
    description:
      'View `vw_dat_truoc`; `thu_tu_cho` chỉ có cho lượt `CHO_XU_LY` của người còn đủ điều kiện.',
  })
  @ApiOkResponse({ type: [DatTruocDong] })
  async datTruoc(@Query() { maNguoiDung, trangThai }: DatTruocQueryDto) {
    const conds: SqlFragment[] = [];
    if (maNguoiDung) conds.push(sql`ma_nguoi_dung = ${maNguoiDung}`);
    if (trangThai) conds.push(sql`trang_thai = ${trangThai}`);
    const rows = await this.db.query(sql`
      SELECT * FROM vw_dat_truoc ${where(conds)}
      ORDER BY ma_sach, trang_thai, thu_tu_cho, ngay_dat`);
    return numberColumns(rows, ['thu_tu_cho']);
  }
}

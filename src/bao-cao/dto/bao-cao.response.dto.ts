import { ApiProperty } from '@nestjs/swagger';
import {
  LoaiPhat,
  TinhTrangTra,
  TrangThaiDatTruoc,
} from '../../common/db-enums.js';
import { ApiEnum } from '../../common/swagger/api-types.js';

// Mỗi class là một dòng của view tương ứng; tên cột giữ nguyên snake_case như trong CSDL.
// Cột đếm/tổng tiền (BIGINT/DECIMAL) được BE ép về number.

/** vw_danh_muc_sach */
export class DanhMucSachDong {
  @ApiProperty({ example: 'S001' })
  ma_sach!: string;
  @ApiProperty()
  ten_sach!: string;
  @ApiProperty()
  ten_the_loai!: string;
  @ApiProperty()
  ten_nxb!: string;
  @ApiProperty({ type: Number, nullable: true })
  nam_xuat_ban!: number | null;
  @ApiProperty({ description: 'Tổng số bản (không tính MAT/NGUNG_PHUC_VU)' })
  tong_so_ban!: number;
  @ApiProperty({ description: 'Số bản đang SAN_SANG' })
  so_ban_san_sang!: number;
}

/** vw_sach_dang_muon */
export class SachDangMuonDong {
  @ApiProperty({ example: 'PM000001' })
  ma_phieu!: string;
  @ApiProperty({ example: 'SV001' })
  ma_nguoi_dung!: string;
  @ApiProperty()
  ho_ten!: string;
  @ApiProperty({ example: 'BS001' })
  ma_ban_sach!: string;
  @ApiProperty({ example: 'S001' })
  ma_sach!: string;
  @ApiProperty()
  ten_sach!: string;
  @ApiProperty({ type: String, format: 'date-time', description: 'Kiểu DATE' })
  ngay_muon!: Date;
  @ApiProperty({ type: String, format: 'date-time', description: 'Kiểu DATE' })
  han_tra!: Date;
  @ApiProperty({
    description: 'Số ngày quá hạn tính đến hôm nay (0 nếu chưa quá hạn)',
  })
  so_ngay_qua_han!: number;
}

/** vw_muon_qua_han */
export class MuonQuaHanDong {
  @ApiProperty({ example: 'PM000001' })
  ma_phieu!: string;
  @ApiProperty({ example: 'SV001' })
  ma_nguoi_dung!: string;
  @ApiProperty()
  ho_ten!: string;
  @ApiProperty()
  ten_sach!: string;
  @ApiProperty({ type: String, format: 'date-time', description: 'Kiểu DATE' })
  han_tra!: Date;
  @ApiProperty()
  so_ngay_qua_han!: number;
  @ApiProperty({ description: 'Tiền phạt tạm tính (VND), chưa lập phiếu phạt' })
  tien_phat_tam_tinh!: number;
}

/** vw_nguoi_dung_vi_pham */
export class NguoiDungViPhamDong {
  @ApiProperty({ example: 'SV001' })
  ma_nguoi_dung!: string;
  @ApiProperty()
  ho_ten!: string;
  @ApiProperty({ description: 'Số phiếu phạt (không tính phiếu HUY)' })
  so_lan_phat!: number;
  @ApiProperty({ description: 'VND' })
  tong_tien_phat!: number;
  @ApiProperty({ description: 'VND, các phiếu CHUA_THANH_TOAN' })
  con_no!: number;
  @ApiProperty({
    description: 'Số sách đang giữ quá hạn (chưa lập phiếu phạt)',
  })
  so_sach_dang_qua_han!: number;
  @ApiProperty({ description: 'VND' })
  tien_phat_tam_tinh!: number;
}

/** vw_top_sach_muon_nhieu */
export class TopSachMuonNhieuDong {
  @ApiProperty({ example: 'S001' })
  ma_sach!: string;
  @ApiProperty()
  ten_sach!: string;
  @ApiProperty({ description: 'Số lượt mượn (đếm theo từng bản sách)' })
  so_luot_muon!: number;
}

/** vw_thong_ke_tien_phat */
export class ThongKeTienPhatDong {
  @ApiProperty({ example: '2026-09', description: 'Tháng lập phiếu (YYYY-MM)' })
  thang!: string;
  @ApiEnum(LoaiPhat, 'LoaiPhat')
  loai_phat!: LoaiPhat;
  @ApiProperty({ description: 'Số phiếu (không tính HUY)' })
  so_phieu!: number;
  @ApiProperty({ description: 'VND, không tính phiếu HUY' })
  tong_tien!: number;
  @ApiProperty({ description: 'VND' })
  da_thanh_toan!: number;
  @ApiProperty({ description: 'VND' })
  chua_thanh_toan!: number;
  @ApiProperty({ description: 'Số phiếu đã hủy (đếm riêng)' })
  so_phieu_huy!: number;
}

/** vw_lich_su_muon */
export class LichSuMuonDong {
  @ApiProperty({ example: 'SV008' })
  ma_nguoi_dung!: string;
  @ApiProperty()
  ho_ten!: string;
  @ApiProperty({ example: 'PM000007' })
  ma_phieu!: string;
  @ApiProperty({ example: 'BS013' })
  ma_ban_sach!: string;
  @ApiProperty({ example: 'S011' })
  ma_sach!: string;
  @ApiProperty()
  ten_sach!: string;
  @ApiProperty({ type: String, format: 'date-time', description: 'Kiểu DATE' })
  ngay_muon!: Date;
  @ApiProperty({ type: String, format: 'date-time', description: 'Kiểu DATE' })
  han_tra!: Date;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'null = đang mượn',
  })
  ngay_tra!: Date | null;
  @ApiProperty()
  so_lan_gia_han!: number;
  @ApiEnum(TinhTrangTra, 'TinhTrangTra', true)
  tinh_trang_tra!: TinhTrangTra | null;
  @ApiProperty()
  so_ngay_qua_han!: number;
}

/** vw_dat_truoc */
export class DatTruocDong {
  @ApiProperty({ example: 'SV004' })
  ma_nguoi_dung!: string;
  @ApiProperty()
  ho_ten!: string;
  @ApiProperty({ example: 'S001' })
  ma_sach!: string;
  @ApiProperty()
  ten_sach!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  ngay_dat!: Date;
  @ApiEnum(TrangThaiDatTruoc, 'TrangThaiDatTruoc')
  trang_thai!: TrangThaiDatTruoc;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Bản đang giữ cho lượt đặt',
  })
  ma_ban_sach!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  han_giu!: Date | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Vị trí trong hàng chờ (chỉ lượt CHO_XU_LY của người còn đủ điều kiện), ngược lại null',
  })
  thu_tu_cho!: number | null;
}

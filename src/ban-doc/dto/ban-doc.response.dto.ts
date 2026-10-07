import { ApiProperty } from '@nestjs/swagger';
import {
  LoaiPhat,
  TinhTrangTra,
  TrangThaiDatTruoc,
  TrangThaiPhieuPhat,
} from '../../common/db-enums.js';
import { ApiBigInt, ApiEnum } from '../../common/swagger/api-types.js';

/** GET /me/sach-dang-muon (= sp_bandoc_sach_dang_muon) */
export class SachDangMuonCuaToiDto {
  @ApiProperty({ example: 'PM000002' })
  ma_phieu!: string;
  @ApiProperty({
    example: 'BS003',
    description: 'Dùng cho POST /muon-tra/gia-han',
  })
  ma_ban_sach!: string;
  @ApiProperty({ example: 'S002' })
  ma_sach!: string;
  @ApiProperty()
  ten_sach!: string;
  @ApiProperty({ type: String, format: 'date-time', description: 'Kiểu DATE' })
  ngay_muon!: Date;
  @ApiProperty({ type: String, format: 'date-time', description: 'Kiểu DATE' })
  han_tra!: Date;
  @ApiProperty({ description: '0 nếu chưa quá hạn' })
  so_ngay_qua_han!: number;
}

/** GET /me/tien-phat (= sp_bandoc_tien_phat) */
export class TienPhatCuaToiDto {
  @ApiBigInt('Mã phiếu phạt')
  ma_phieu_phat!: string;
  @ApiEnum(LoaiPhat, 'LoaiPhat')
  loai_phat!: LoaiPhat;
  @ApiProperty({ description: 'VND' })
  so_tien!: number;
  @ApiProperty({ nullable: true })
  ly_do!: string | null;
  @ApiEnum(TrangThaiPhieuPhat, 'TrangThaiPhieuPhat')
  trang_thai!: TrangThaiPhieuPhat;
  @ApiProperty({ type: String, format: 'date-time', description: 'Kiểu DATE' })
  ngay_tao!: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  ngay_thanh_toan!: Date | null;
}

/** GET /me/lich-su-muon (= sp_bandoc_lich_su_muon) */
export class LichSuMuonCuaToiDto {
  @ApiProperty({ example: 'PM000002' })
  ma_phieu!: string;
  @ApiProperty({ example: 'BS003' })
  ma_ban_sach!: string;
  @ApiProperty({ example: 'S002' })
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

/** GET /me/dat-truoc (= sp_bandoc_ds_dat_truoc) */
export class DatTruocCuaToiDto {
  @ApiProperty({ example: 'S006' })
  ma_sach!: string;
  @ApiProperty()
  ten_sach!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  ngay_dat!: Date;
  @ApiEnum(TrangThaiDatTruoc, 'TrangThaiDatTruoc')
  trang_thai!: TrangThaiDatTruoc;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Vị trí trong hàng chờ; null nếu không còn chờ hoặc chưa đủ điều kiện mượn',
  })
  thu_tu_cho!: number | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Bản đang giữ cho bạn (SAN_SANG_NHAN)',
  })
  ma_ban_sach!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  han_giu!: Date | null;
}

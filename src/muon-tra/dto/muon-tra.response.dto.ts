import { ApiProperty } from '@nestjs/swagger';
import { TinhTrangTra, TrangThaiPhieuMuon } from '../../common/db-enums.js';
import { ApiBigInt, ApiEnum } from '../../common/swagger/api-types.js';
import { NguoiDungTomTatDto } from '../../docgia/dto/docgia.response.dto.js';
import { PhieuPhatDto } from '../../phat/dto/phat.response.dto.js';

/** Một lượt mượn một bản sách (bảng `ct_phieu_muon`). */
export class CtPhieuMuonDto {
  @ApiBigInt()
  id!: string;
  @ApiBigInt()
  phieuMuonId!: string;
  @ApiBigInt()
  banSachId!: string;
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Hạn trả (kiểu DATE)',
  })
  hanTra!: Date;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'null = đang mượn',
  })
  ngayTra!: Date | null;
  @ApiProperty({ type: Number, description: 'Số lần đã gia hạn' })
  soLanGiaHan!: number;
  @ApiEnum(TinhTrangTra, 'TinhTrangTra', true)
  tinhTrangTra!: TinhTrangTra | null;
  @ApiBigInt(
    'Cột sinh tự động (khác null khi đang mượn); không dùng ở FE',
    true,
  )
  banSachDangMuon!: string | null;
}

class MuonSachDto {
  @ApiProperty({ example: 'S001' })
  maSach!: string;
  @ApiProperty()
  tenSach!: string;
}

class MuonBanSachDto {
  @ApiProperty({ example: 'BS001' })
  maBanSach!: string;
  @ApiProperty({ type: MuonSachDto })
  sach!: MuonSachDto;
}

class MuonPhieuMaDto {
  @ApiProperty({ example: 'PM001' })
  maPhieu!: string;
}

export class CtPhieuMuonChiTietDto extends CtPhieuMuonDto {
  @ApiProperty({ type: MuonBanSachDto })
  banSach!: MuonBanSachDto;
  @ApiProperty({
    type: [PhieuPhatDto],
    description: 'Phiếu phạt (quá hạn/hư hỏng/mất) sinh ra từ lượt mượn này',
  })
  phieuPhats!: PhieuPhatDto[];
}

export class PhieuMuonDto {
  @ApiBigInt()
  id!: string;
  @ApiProperty({ example: 'PM001', nullable: true })
  maPhieu!: string | null;
  @ApiBigInt('Người mượn (nguoi_dung.id)')
  nguoiDungId!: string;
  @ApiBigInt('Cán bộ lập phiếu (nguoi_dung.id)')
  nhanVienId!: string;
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Ngày mượn (kiểu DATE)',
  })
  ngayMuon!: Date;
  @ApiEnum(TrangThaiPhieuMuon, 'TrangThaiPhieuMuon')
  trangThai!: TrangThaiPhieuMuon;
}

/** Phiếu mượn đầy đủ: người mượn, cán bộ lập phiếu, từng bản sách và phiếu phạt kèm theo. */
export class PhieuMuonChiTietDto extends PhieuMuonDto {
  @ApiProperty({ type: NguoiDungTomTatDto })
  nguoiDung!: NguoiDungTomTatDto;
  @ApiProperty({ type: NguoiDungTomTatDto })
  nhanVien!: NguoiDungTomTatDto;
  @ApiProperty({ type: [CtPhieuMuonChiTietDto] })
  ctPhieuMuons!: CtPhieuMuonChiTietDto[];
}

/** Kết quả trả sách: lượt mượn vừa đóng cùng phiếu phạt trigger/procedure vừa sinh. */
export class TraSachKetQuaDto extends CtPhieuMuonDto {
  @ApiProperty({ type: [PhieuPhatDto] })
  phieuPhats!: PhieuPhatDto[];
  @ApiProperty({ type: MuonPhieuMaDto })
  phieuMuon!: MuonPhieuMaDto;
}

/** Kết quả gia hạn: lượt mượn sau khi gia hạn (hanTra và soLanGiaHan đã cập nhật). */
export class GiaHanKetQuaDto extends CtPhieuMuonDto {
  @ApiProperty({ type: MuonPhieuMaDto })
  phieuMuon!: MuonPhieuMaDto;
}

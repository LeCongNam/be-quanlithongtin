import { ApiProperty } from '@nestjs/swagger';
import { LoaiPhat, TrangThaiPhieuPhat } from '../../common/db-enums.js';
import {
  ApiBigInt,
  ApiDecimal,
  ApiEnum,
} from '../../common/swagger/api-types.js';
import { NguoiDungTomTatDto } from '../../docgia/dto/docgia.response.dto.js';

export class PhieuPhatDto {
  @ApiBigInt('Mã phiếu phạt (dùng ở /phat/:id/...)')
  id!: string;
  @ApiBigInt()
  ctPhieuMuonId!: string;
  @ApiEnum(LoaiPhat, 'LoaiPhat')
  loaiPhat!: LoaiPhat;
  @ApiDecimal('Số tiền phạt (VND)')
  soTien!: string;
  @ApiProperty({ nullable: true })
  lyDo!: string | null;
  @ApiEnum(TrangThaiPhieuPhat, 'TrangThaiPhieuPhat')
  trangThai!: TrangThaiPhieuPhat;
  @ApiProperty({ type: String, format: 'date-time' })
  ngayTao!: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  ngayThanhToan!: Date | null;
}

class PhatSachDto {
  @ApiProperty()
  tenSach!: string;
}

class PhatBanSachDto {
  @ApiProperty({ example: 'BS001' })
  maBanSach!: string;
  @ApiProperty({ type: PhatSachDto })
  sach!: PhatSachDto;
}

class PhatPhieuMuonDto {
  @ApiProperty({ example: 'PM001' })
  maPhieu!: string;
  @ApiProperty({ type: NguoiDungTomTatDto })
  nguoiDung!: NguoiDungTomTatDto;
}

class PhatCtPhieuMuonDto {
  @ApiProperty({ type: PhatBanSachDto })
  banSach!: PhatBanSachDto;
  @ApiProperty({ type: PhatPhieuMuonDto })
  phieuMuon!: PhatPhieuMuonDto;
}

/** Phiếu phạt kèm người bị phạt và sách (GET /phat). */
export class PhieuPhatChiTietDto extends PhieuPhatDto {
  @ApiProperty({ type: PhatCtPhieuMuonDto })
  ctPhieuMuon!: PhatCtPhieuMuonDto;
}

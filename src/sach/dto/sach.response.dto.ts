import { ApiProperty } from '@nestjs/swagger';
import { TinhTrangBanSach } from '../../common/db-enums.js';
import {
  ApiBigInt,
  ApiDecimal,
  ApiEnum,
} from '../../common/swagger/api-types.js';
import {
  NhaXuatBanDto,
  TacGiaDto,
  TheLoaiDto,
} from '../../danh-muc/dto/danh-muc.response.dto.js';

/** Một dòng của `vw_tra_cuu_sach` (GET /sach); cột giữ nguyên tên snake_case của view. */
export class TraCuuSachDto {
  @ApiProperty({ example: 'S001' })
  ma_sach!: string;
  @ApiProperty({ nullable: true })
  isbn!: string | null;
  @ApiProperty()
  ten_sach!: string;
  @ApiProperty({
    nullable: true,
    description: 'Tên các tác giả, cách nhau bằng ", "',
  })
  ds_tac_gia!: string | null;
  @ApiProperty()
  ten_the_loai!: string;
  @ApiProperty()
  ten_nxb!: string;
  @ApiProperty({ type: Number, nullable: true })
  nam_xuat_ban!: number | null;
  @ApiProperty({ example: 'Tiếng Việt' })
  ngon_ngu!: string;
  @ApiProperty({
    type: Number,
    description: 'Số bản đang SAN_SANG (có thể mượn ngay)',
  })
  so_ban_san_sang!: number;
}

export class SachDto {
  @ApiBigInt()
  id!: string;
  @ApiProperty({ example: 'S001' })
  maSach!: string;
  @ApiProperty({ nullable: true })
  isbn!: string | null;
  @ApiProperty()
  tenSach!: string;
  @ApiBigInt('the_loai.id')
  theLoaiId!: string;
  @ApiBigInt('nha_xuat_ban.id')
  nxbId!: string;
  @ApiProperty({ type: Number, nullable: true })
  namXuatBan!: number | null;
  @ApiProperty({ example: 'Tiếng Việt' })
  ngonNgu!: string;
  @ApiDecimal('Giá bìa (VND)', true)
  giaBia!: string | null;
  @ApiProperty({ nullable: true })
  moTa!: string | null;
}

export class SachTacGiaDto {
  @ApiBigInt()
  sachId!: string;
  @ApiBigInt()
  tacGiaId!: string;
  @ApiProperty({ type: TacGiaDto })
  tacGia!: TacGiaDto;
}

/** Sách kèm tác giả (kết quả POST /sach). */
export class SachCoTacGiaDto extends SachDto {
  @ApiProperty({ type: [SachTacGiaDto] })
  sachTacGias!: SachTacGiaDto[];
}

/** Sách kèm thể loại, NXB và tác giả (GET /sach/:id). */
export class SachChiTietDto extends SachCoTacGiaDto {
  @ApiProperty({ type: TheLoaiDto })
  theLoai!: TheLoaiDto;
  @ApiProperty({ type: NhaXuatBanDto })
  nhaXuatBan!: NhaXuatBanDto;
}

export class BanSachDto {
  @ApiBigInt()
  id!: string;
  @ApiProperty({
    example: 'BS001',
    description: 'Mã bản sách (dùng khi mượn/trả/gia hạn)',
  })
  maBanSach!: string;
  @ApiBigInt('sach.id')
  sachId!: string;
  @ApiProperty({ example: 'A1-03' })
  viTriKe!: string;
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Ngày nhập (kiểu DATE)',
  })
  ngayNhap!: Date;
  @ApiEnum(TinhTrangBanSach, 'TinhTrangBanSach')
  tinhTrang!: TinhTrangBanSach;
}

/** Một bản vừa nhập qua sp_them_ban_sach (POST /sach/:id/ban-sach). */
export class BanSachMoiDto {
  @ApiProperty({ example: 'BS021' })
  ma_ban_sach!: string;
  @ApiProperty({ example: 'A1-03' })
  vi_tri_ke!: string;
  @ApiEnum(TinhTrangBanSach, 'TinhTrangBanSach')
  tinh_trang!: TinhTrangBanSach;
}

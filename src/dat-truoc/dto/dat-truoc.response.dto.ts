import { ApiProperty } from '@nestjs/swagger';
import { TrangThaiDatTruoc } from '../../common/db-enums.js';
import { ApiBigInt, ApiEnum } from '../../common/swagger/api-types.js';
import { NguoiDungTomTatDto } from '../../docgia/dto/docgia.response.dto.js';

class DatTruocSachDto {
  @ApiProperty({ example: 'S004' })
  maSach!: string;
  @ApiProperty()
  tenSach!: string;
}

export class DatTruocDto {
  @ApiBigInt()
  id!: string;
  @ApiBigInt()
  nguoiDungId!: string;
  @ApiBigInt()
  sachId!: string;
  @ApiBigInt('Bản sách đang giữ cho lượt đặt (nếu có)', true)
  banSachId!: string | null;
  @ApiProperty({ type: String, format: 'date-time' })
  ngayDat!: Date;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Hạn giữ sách khi SAN_SANG_NHAN',
  })
  hanGiu!: Date | null;
  @ApiEnum(TrangThaiDatTruoc, 'TrangThaiDatTruoc')
  trangThai!: TrangThaiDatTruoc;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cột sinh tự động của DB (chống đặt trùng); FE bỏ qua',
  })
  khoaDangHoatDong!: string | null;
  @ApiBigInt('Cột sinh tự động của DB; FE bỏ qua', true)
  banSachDangGiu!: string | null;
  @ApiProperty({ type: DatTruocSachDto })
  sach!: DatTruocSachDto;
  @ApiProperty({ type: NguoiDungTomTatDto })
  nguoiDung!: NguoiDungTomTatDto;
}

export class HuyDatTruocKetQuaDto {
  @ApiProperty({ example: 'S004' })
  maSach!: string;
  @ApiProperty({ example: 'SV002' })
  maNguoiDung!: string;
  @ApiProperty({ example: 'HUY' })
  trangThai!: string;
}

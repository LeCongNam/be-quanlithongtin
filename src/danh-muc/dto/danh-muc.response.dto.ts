import { ApiProperty } from '@nestjs/swagger';
import { ApiBigInt } from '../../common/swagger/api-types.js';

export class TheLoaiDto {
  @ApiBigInt()
  id!: string;
  @ApiProperty({ example: 'TL001' })
  maTheLoai!: string;
  @ApiProperty({ example: 'Công nghệ thông tin' })
  tenTheLoai!: string;
  @ApiProperty({ nullable: true })
  moTa!: string | null;
}

export class NhaXuatBanDto {
  @ApiBigInt()
  id!: string;
  @ApiProperty({ example: 'NXB001' })
  maNxb!: string;
  @ApiProperty()
  tenNxb!: string;
  @ApiProperty({ nullable: true })
  diaChi!: string | null;
  @ApiProperty({ nullable: true })
  email!: string | null;
  @ApiProperty({ nullable: true })
  sdt!: string | null;
}

export class TacGiaDto {
  @ApiBigInt()
  id!: string;
  @ApiProperty({ example: 'TG001' })
  maTacGia!: string;
  @ApiProperty()
  tenTacGia!: string;
  @ApiProperty({ nullable: true })
  quocTich!: string | null;
  @ApiProperty({ type: Number, nullable: true })
  namSinh!: number | null;
}

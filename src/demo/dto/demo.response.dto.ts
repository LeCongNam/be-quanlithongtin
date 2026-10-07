import { ApiProperty } from '@nestjs/swagger';

export class DemoMucDto {
  @ApiProperty({ example: 'sp-tra-sach' })
  id!: string;
  @ApiProperty({ enum: ['PROCEDURE', 'TRIGGER', 'FUNCTION', 'CURSOR'] })
  loai!: string;
  @ApiProperty()
  tieuDe!: string;
  @ApiProperty({ description: 'Bước 1: bài toán', type: String })
  baiToan!: string;
  @ApiProperty({ type: [String], description: 'Tên routine/trigger liên quan' })
  doiTuong!: string[];
}

export class DemoGoiYDto {
  @ApiProperty()
  giaTri!: string;
  @ApiProperty({ nullable: true, type: String })
  moTa!: string | null;
}

export class DemoThamSoMoTaDto {
  @ApiProperty({ example: 'ma_ban_sach' })
  ten!: string;
  @ApiProperty()
  nhan!: string;
  @ApiProperty({ enum: ['text', 'number', 'date'] })
  kieu!: string;
  @ApiProperty({ nullable: true, type: String })
  macDinh!: string | null;
  @ApiProperty({ description: 'true: được để trống (truyền NULL)' })
  tuyChon!: boolean;
  @ApiProperty({ type: [DemoGoiYDto], description: 'Giá trị gợi ý lấy từ dữ liệu hiện có' })
  goiY!: DemoGoiYDto[];
}

export class DemoTinhHuongDto {
  @ApiProperty()
  nhan!: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  thamSo!: Record<string, string>;
}

export class DemoDinhNghiaDto {
  @ApiProperty({ example: 'sp_tra_sach' })
  ten!: string;
  @ApiProperty({ description: 'Bước 2: câu lệnh CREATE đọc từ CSDL (trigger: từ sql/05_triggers.sql)', nullable: true, type: String })
  sql!: string | null;
  @ApiProperty({ enum: ['CSDL', 'TEP_SQL'] })
  nguon!: string;
}

export class DemoChiTietDto extends DemoMucDto {
  @ApiProperty({ type: [DemoDinhNghiaDto] })
  dinhNghia!: DemoDinhNghiaDto[];
  @ApiProperty({ type: [DemoThamSoMoTaDto] })
  thamSo!: DemoThamSoMoTaDto[];
  @ApiProperty({ type: [DemoTinhHuongDto] })
  tinhHuong!: DemoTinhHuongDto[];
  @ApiProperty({ description: 'Bước 4: câu lệnh sẽ thực thi, tham số dạng `:ten`' })
  lenh!: string;
  @ApiProperty({ type: [String], description: 'Nhãn các bảng liên quan (bước 3 và 5)' })
  bang!: string[];
}

export class DemoBangDto {
  @ApiProperty()
  nhan!: string;
  @ApiProperty({ type: [String] })
  cot!: string[];
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  dong!: Record<string, unknown>[];
}

export class DemoBangLienQuanDto {
  @ApiProperty({ type: [DemoBangDto] })
  bang!: DemoBangDto[];
}

export class DemoKetQuaDto {
  @ApiProperty({ description: 'Câu lệnh đã thực thi, tham số đã thay giá trị' })
  lenh!: string;
  @ApiProperty()
  thanhCong!: boolean;
  @ApiProperty({ nullable: true, type: String, description: 'Thông báo lỗi của CSDL (SIGNAL của procedure/trigger)' })
  loi!: string | null;
  @ApiProperty({ description: 'true: đã ROLLBACK, dữ liệu không đổi' })
  daHoanTac!: boolean;
  @ApiProperty({ nullable: true, type: Number, description: 'Số dòng bị ảnh hưởng (câu DML)' })
  soDongAnhHuong!: number | null;
  @ApiProperty({ type: DemoBangDto, nullable: true, description: 'Output của function/procedure có result set' })
  ketQua!: DemoBangDto | null;
  @ApiProperty({ type: [DemoBangDto], description: 'Bước 5: các bảng liên quan sau khi chạy (trước khi hoàn tác)' })
  bangSau!: DemoBangDto[];
}

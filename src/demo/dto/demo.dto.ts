import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class DemoThamSoDto {
  /** Giá trị các tham số theo tên (`ten` ở `GET /demo/:id`); tham số tùy chọn để trống thì bỏ qua hoặc gửi chuỗi rỗng. */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { ma_ban_sach: 'BS006', tinh_trang_tra: 'BINH_THUONG' },
  })
  @IsObject()
  thamSo!: Record<string, string>;
}

export class DemoChayDto extends DemoThamSoDto {
  /** true (mặc định): chạy trong transaction rồi ROLLBACK, dữ liệu không đổi nhưng vẫn thấy kết quả "sau khi chạy". */
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  hoanTac: boolean = true;
}

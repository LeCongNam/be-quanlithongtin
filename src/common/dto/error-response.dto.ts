import { ApiProperty } from '@nestjs/swagger';

/**
 * Dạng lỗi chung của BE: lỗi của Nest (400/401/403/404/...) và lỗi do `DatabaseExceptionFilter`
 * (SIGNAL 45000 của procedure/trigger -> 422 kèm thông báo nghiệp vụ tiếng Việt không dấu).
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 422 })
  statusCode!: number;

  @ApiProperty({
    example: 'Unprocessable Entity',
    required: false,
    description:
      'Tên mã HTTP (chỉ có ở lỗi do bộ lọc CSDL và một số lỗi của Nest)',
  })
  error?: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Nguoi dung dang no phat',
    description:
      'Chuỗi thông báo; lỗi validate dữ liệu gửi lên (400) là mảng các thông báo',
  })
  message!: string | string[];
}

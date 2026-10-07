import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto.js';

const DESCRIPTIONS: Record<number, string> = {
  400: 'Dữ liệu gửi lên không hợp lệ (message là mảng lỗi validate) hoặc vi phạm CHECK của CSDL',
  401: 'Thiếu/sai/hết hạn JWT, hoặc tài khoản/người dùng đang bị khóa hay ngừng hoạt động',
  403: 'Vai trò của tài khoản không được phép gọi endpoint này',
  404: 'Không tìm thấy bản ghi',
  409: 'Trùng giá trị duy nhất hoặc vi phạm khóa ngoại',
  422: 'Vi phạm quy tắc nghiệp vụ do procedure/trigger của CSDL báo (message là thông báo của CSDL)',
};

/** Mô tả các mã lỗi mà endpoint có thể trả, cùng một dạng `ErrorResponseDto`. */
export const ApiErrors = (...statuses: number[]) =>
  applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status],
        type: ErrorResponseDto,
      }),
    ),
  );

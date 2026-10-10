import { HttpStatus } from '@nestjs/common';

// Mã lỗi MySQL mà BE phân biệt (https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html)
const ER_DUP_ENTRY = 1062;
const ER_SIGNAL_EXCEPTION = 1644; // SIGNAL SQLSTATE '45000' từ trigger/procedure
const ER_FK_VIOLATIONS = new Set([1217, 1451, 1452]);
const ER_CHECK_VIOLATION = 3819;

/** Lỗi phát sinh từ driver/CSDL, bọc lại để filter toàn cục nhận biết (HttpException của Nest không bị bọc). */
export class DatabaseError extends Error {
  readonly errno?: number;
  readonly sqlState?: string;
  readonly sqlMessage?: string;

  constructor(cause: unknown) {
    const c = (cause ?? {}) as {
      errno?: unknown;
      sqlState?: unknown;
      sqlMessage?: unknown;
      message?: unknown;
    };
    const sqlMessage =
      typeof c.sqlMessage === 'string' ? c.sqlMessage : undefined;
    super(
      sqlMessage ?? (typeof c.message === 'string' ? c.message : String(cause)),
      {
        cause,
      },
    );
    this.name = 'DatabaseError';
    this.sqlMessage = sqlMessage;
    if (typeof c.errno === 'number') this.errno = c.errno;
    if (typeof c.sqlState === 'string') this.sqlState = c.sqlState;
  }
}

/** UPDATE/DELETE theo khóa không có dòng nào khớp (thay cho P2025 của Prisma) -> 404. */
export class RecordNotFoundError extends Error {
  constructor() {
    super('Không tìm thấy bản ghi');
    this.name = 'RecordNotFoundError';
  }
}

/** Đổi lỗi CSDL sang mã HTTP + thông báo; SIGNAL của procedure/trigger (thông báo nghiệp vụ tiếng Việt) -> 422. */
export function mapDbError(error: DatabaseError | RecordNotFoundError): {
  status: number;
  message: string;
} {
  if (error instanceof RecordNotFoundError) {
    return { status: HttpStatus.NOT_FOUND, message: error.message };
  }
  if (error.errno === ER_SIGNAL_EXCEPTION) {
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      message: error.sqlMessage ?? 'Vi pham quy tac nghiep vu',
    };
  }
  if (error.errno === ER_DUP_ENTRY) {
    return {
      status: HttpStatus.CONFLICT,
      message: 'Du lieu da ton tai (trung gia tri duy nhat)',
    };
  }
  if (error.errno !== undefined && ER_FK_VIOLATIONS.has(error.errno)) {
    return {
      status: HttpStatus.CONFLICT,
      message: 'Vi pham rang buoc khoa ngoai',
    };
  }
  if (error.errno === ER_CHECK_VIOLATION) {
    return {
      status: HttpStatus.BAD_REQUEST,
      message: 'Du lieu vi pham rang buoc CHECK cua CSDL',
    };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Loi co so du lieu',
  };
}

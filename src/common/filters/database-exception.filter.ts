import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

// MySQL SIGNAL SQLSTATE '45000' (trigger/procedure) -> mã lỗi 1644 trong Prisma raw query.
const MYSQL_SIGNAL_CODE = '1644';
// Trigger SIGNAL khi ghi bằng model Prisma (create/update...) đến dưới dạng lỗi không xác định:
// `MysqlError { code: 1644, message: "...", state: "45000" }`.
const MYSQL_SIGNAL_IN_MESSAGE =
  /MysqlError \{ code: 1644, message: "((?:[^"\\]|\\.)*)"/;
// Khóa ngoại: MySQL 8 báo 1217 (xóa/sửa dòng cha còn dòng con, FK NO ACTION) hoặc 1451; 1452 là thêm dòng con
// không có dòng cha. Prisma không đổi các mã này sang P2003 nên đến dưới dạng lỗi không xác định.
const MYSQL_FOREIGN_KEY_VIOLATION = /code: (?:1217|1451|1452)\b/;
// MySQL 3819: vi phạm CHECK constraint.
const MYSQL_CHECK_VIOLATION = /code: 3819/;

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientUnknownRequestError,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message } = this.map(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception.message);
    }

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status],
      message,
    });
  }

  private map(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientUnknownRequestError,
  ) {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2010': {
          const meta = exception.meta as
            { code?: string; message?: string } | undefined;
          if (meta?.code === MYSQL_SIGNAL_CODE) {
            return {
              status: HttpStatus.UNPROCESSABLE_ENTITY,
              message: meta.message ?? 'Vi pham quy tac nghiep vu',
            };
          }
          break;
        }
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            message: 'Du lieu da ton tai (trung gia tri duy nhat)',
          };
        case 'P2003':
          return {
            status: HttpStatus.CONFLICT,
            message: 'Vi pham rang buoc khoa ngoai',
          };
        case 'P2025':
          return {
            status: HttpStatus.NOT_FOUND,
            message: 'Khong tim thay ban ghi',
          };
      }
    } else if (MYSQL_SIGNAL_IN_MESSAGE.test(exception.message)) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: MYSQL_SIGNAL_IN_MESSAGE.exec(exception.message)![1],
      };
    } else if (MYSQL_FOREIGN_KEY_VIOLATION.test(exception.message)) {
      return {
        status: HttpStatus.CONFLICT,
        message: 'Vi pham rang buoc khoa ngoai',
      };
    } else if (MYSQL_CHECK_VIOLATION.test(exception.message)) {
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
}

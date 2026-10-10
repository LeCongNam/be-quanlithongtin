import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DatabaseError,
  mapDbError,
  RecordNotFoundError,
} from '../../database/db-error.js';

/** Đổi lỗi CSDL (`DatabaseError`, `RecordNotFoundError` từ `DbService`) sang phản hồi HTTP; xem `mapDbError`. */
@Catch(DatabaseError, RecordNotFoundError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: DatabaseError | RecordNotFoundError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message } = mapDbError(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception.message);
    }

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status],
      message,
    });
  }
}

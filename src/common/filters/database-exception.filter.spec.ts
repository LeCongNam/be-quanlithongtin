import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { DatabaseError, RecordNotFoundError } from '../../database/db-error.js';
import { DatabaseExceptionFilter } from './database-exception.filter.js';

function run(exception: DatabaseError | RecordNotFoundError) {
  let body: { statusCode: number; error: string; message: string } | undefined;
  const response = {
    status: (code: number) => ({
      json: (b: { statusCode: number; error: string; message: string }) => {
        body = { ...b, statusCode: code };
      },
    }),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  new DatabaseExceptionFilter().catch(exception, host);
  return body!;
}

const loi = (errno: number, sqlMessage = 'boom') =>
  new DatabaseError({ errno, sqlMessage });

describe('DatabaseExceptionFilter', () => {
  it('SIGNAL 45000 của procedure/trigger -> 422 kèm thông báo nghiệp vụ', () => {
    expect(run(loi(1644, 'Nguoi dung dang no phat'))).toEqual({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: 'UNPROCESSABLE_ENTITY',
      message: 'Nguoi dung dang no phat',
    });
  });

  it('trùng giá trị unique -> 409', () => {
    expect(run(loi(1062)).statusCode).toBe(HttpStatus.CONFLICT);
  });

  it.each([1217, 1451, 1452])('khóa ngoại (MySQL %i) -> 409', (errno) => {
    expect(run(loi(errno)).statusCode).toBe(HttpStatus.CONFLICT);
  });

  it('CHECK constraint bị vi phạm -> 400', () => {
    expect(run(loi(3819)).statusCode).toBe(HttpStatus.BAD_REQUEST);
  });

  it('không có dòng nào khớp -> 404', () => {
    expect(run(new RecordNotFoundError())).toEqual({
      statusCode: HttpStatus.NOT_FOUND,
      error: 'NOT_FOUND',
      message: 'Không tìm thấy bản ghi',
    });
  });

  it('lỗi khác -> 500 và không lộ chi tiết', () => {
    const res = run(loi(1064, 'syntax error near secret'));
    expect(res.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.message).not.toContain('secret');
  });
});

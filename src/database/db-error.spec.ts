import { HttpStatus } from '@nestjs/common';
import { DatabaseError, mapDbError, RecordNotFoundError } from './db-error.js';

/** Lỗi như mysql2 ném ra. */
const mysqlError = (errno: number, sqlMessage: string, sqlState = '23000') =>
  Object.assign(new Error(`${errno}: ${sqlMessage}`), {
    errno,
    sqlState,
    sqlMessage,
  });

describe('mapDbError', () => {
  it('SIGNAL 45000 của procedure/trigger -> 422 kèm thông báo nghiệp vụ', () => {
    const err = new DatabaseError(
      mysqlError(1644, 'Nguoi dung dang no phat', '45000'),
    );
    expect(mapDbError(err)).toEqual({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      message: 'Nguoi dung dang no phat',
    });
  });

  it('trùng giá trị duy nhất (1062) -> 409', () => {
    const err = new DatabaseError(mysqlError(1062, "Duplicate entry 'SV001'"));
    expect(mapDbError(err).status).toBe(HttpStatus.CONFLICT);
  });

  it.each([1217, 1451, 1452])('khóa ngoại (%i) -> 409', (errno) => {
    const err = new DatabaseError(
      mysqlError(errno, 'foreign key constraint fails'),
    );
    expect(mapDbError(err).status).toBe(HttpStatus.CONFLICT);
  });

  it('vi phạm CHECK (3819) -> 400', () => {
    const err = new DatabaseError(
      mysqlError(3819, 'Check constraint violated'),
    );
    expect(mapDbError(err).status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('không có dòng khớp -> 404', () => {
    expect(mapDbError(new RecordNotFoundError())).toEqual({
      status: HttpStatus.NOT_FOUND,
      message: 'Không tìm thấy bản ghi',
    });
  });

  it('lỗi khác (cú pháp, mất kết nối) -> 500 và không lộ chi tiết', () => {
    const syntax = mapDbError(
      new DatabaseError(mysqlError(1064, 'syntax error near secret', '42000')),
    );
    expect(syntax.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(syntax.message).not.toContain('secret');
    const net = mapDbError(new DatabaseError(new Error('ECONNRESET')));
    expect(net.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});

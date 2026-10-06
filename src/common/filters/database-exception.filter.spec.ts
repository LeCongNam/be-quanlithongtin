import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseExceptionFilter } from './database-exception.filter.js';

function run(
  exception:
    | Prisma.PrismaClientKnownRequestError
    | Prisma.PrismaClientUnknownRequestError,
) {
  let body: { statusCode: number; message: string } | undefined;
  const response = {
    status: (code: number) => ({
      json: (b: { statusCode: number; message: string }) => {
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

const known = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
    meta,
  });

describe('DatabaseExceptionFilter', () => {
  it('SIGNAL 45000 của procedure/trigger -> 422 kèm thông báo nghiệp vụ', () => {
    const res = run(
      known('P2010', { code: '1644', message: 'Nguoi dung dang no phat' }),
    );
    expect(res).toMatchObject({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: 'Nguoi dung dang no phat',
    });
  });

  it.each([
    ['P2002', HttpStatus.CONFLICT],
    ['P2003', HttpStatus.CONFLICT],
    ['P2025', HttpStatus.NOT_FOUND],
  ])('%s -> %i', (code, status) => {
    expect(run(known(code)).statusCode).toBe(status);
  });

  it('CHECK constraint bị vi phạm -> 400', () => {
    const err = new Prisma.PrismaClientUnknownRequestError(
      'MysqlError { code: 3819 }',
      { clientVersion: 'test' },
    );
    expect(run(err).statusCode).toBe(HttpStatus.BAD_REQUEST);
  });

  it('lỗi khác -> 500 và không lộ chi tiết', () => {
    const res = run(
      known('P2010', { code: '1064', message: 'syntax error near secret' }),
    );
    expect(res.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.message).not.toContain('secret');
  });
});

import { SqlExecutor } from './db.service.js';
import { DatabaseError, RecordNotFoundError } from './db-error.js';
import { sql } from './sql.js';

function fake(result: unknown = []) {
  const calls: [string, unknown[]][] = [];
  const target = {
    query: (text: string, values: unknown[]) => {
      calls.push([text, values]);
      return result instanceof Error
        ? Promise.reject(result)
        : Promise.resolve([result, []] as [unknown, unknown]);
    },
  };
  return { db: new SqlExecutor(target), calls };
}

describe('SqlExecutor', () => {
  it('query trả các dòng và nhận cả SqlFragment', async () => {
    const { db, calls } = fake([{ a: 1 }]);
    expect(await db.query(sql`SELECT ${1} AS a`)).toEqual([{ a: 1 }]);
    expect(calls[0]).toEqual(['SELECT ? AS a', [1]]);
  });

  it('queryOne trả dòng đầu hoặc undefined', async () => {
    expect(await fake([{ a: 1 }, { a: 2 }]).db.queryOne('SELECT 1')).toEqual({
      a: 1,
    });
    expect(await fake([]).db.queryOne('SELECT 1')).toBeUndefined();
  });

  it('call ghép CALL sp_x(?, ?) và trả result set đầu tiên với tên cột', async () => {
    const { db, calls } = fake([
      [{ ma_ban_sach: 'BS001' }],
      { affectedRows: 0 },
    ]);
    expect(await db.call('sp_them_ban_sach', ['S001', 2])).toEqual([
      { ma_ban_sach: 'BS001' },
    ]);
    expect(calls[0]).toEqual(['CALL sp_them_ban_sach(?, ?)', ['S001', 2]]);
  });

  it('call trả mảng rỗng với procedure không có result set', async () => {
    expect(await fake({ affectedRows: 0 }).db.call('sp_x', [1])).toEqual([]);
  });

  it('call từ chối tên không phải sp_*', async () => {
    await expect(fake().db.call('sp_x; DROP TABLE a')).rejects.toThrow(
      /không hợp lệ/,
    );
  });

  it('execute lấy header cuối khi CALL có result set', async () => {
    const header = { affectedRows: 3 };
    expect(
      (await fake([[{ a: 1 }], header]).db.execute('CALL sp_x()')).affectedRows,
    ).toBe(3);
  });

  it('executeOne ném RecordNotFoundError khi không có dòng nào khớp', async () => {
    await expect(
      fake({ affectedRows: 0 }).db.executeOne('UPDATE t SET a = 1'),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
    await expect(
      fake({ affectedRows: 1 }).db.executeOne('UPDATE t SET a = 1'),
    ).resolves.toMatchObject({ affectedRows: 1 });
  });

  it('bọc lỗi driver thành DatabaseError giữ errno và sqlMessage', async () => {
    const driverErr = Object.assign(new Error('x'), {
      errno: 1644,
      sqlState: '45000',
      sqlMessage: 'Thong bao nghiep vu',
    });
    const err = await fake(driverErr)
      .db.execute('CALL sp_x()')
      .catch((e) => e);
    expect(err).toBeInstanceOf(DatabaseError);
    expect(err).toMatchObject({
      errno: 1644,
      sqlMessage: 'Thong bao nghiep vu',
    });
  });
});

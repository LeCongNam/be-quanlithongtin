import { ConfigService } from '@nestjs/config';
import { DatabaseError } from '../src/database/db-error.js';
import { DbService } from '../src/database/db.service.js';
import { sql } from '../src/database/sql.js';

/** Chạy trên DB thật (docker compose up -d db). Dữ liệu ghi trong test đều được ROLLBACK. */
describe('DbService (MySQL thật)', () => {
  let db: DbService;
  const sfx = Date.now().toString(36).toUpperCase().slice(-7);

  beforeAll(async () => {
    db = new DbService(
      new ConfigService({
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'mysql://qltt:qltt_password@localhost:3306/qltv_nhom8',
      }),
    );
    await db.onModuleInit();
  });

  afterAll(() => db.onModuleDestroy());

  it('BIGINT là chuỗi, INT là số, COUNT là chuỗi', async () => {
    const row = await db.queryOne<{ id: string; nam: number; n: string }>(
      `SELECT s.id, s.nam_xuat_ban AS nam, (SELECT COUNT(*) FROM sach) AS n
       FROM sach s WHERE s.ma_sach = 'S001'`,
    );
    expect(typeof row?.id).toBe('string');
    expect(typeof row?.nam).toBe('number');
    expect(typeof row?.n).toBe('string');
  });

  it('DECIMAL bỏ số 0 thừa, DATE ra Date UTC (JSON ISO)', async () => {
    const [pp] = await db.query<{ so_tien: string; ngay_tao: Date }>(
      'SELECT so_tien, ngay_tao FROM phieu_phat ORDER BY id LIMIT 1',
    );
    expect(pp.so_tien).toMatch(/^\d+(\.\d*[1-9])?$/);
    expect(pp.ngay_tao).toBeInstanceOf(Date);
    expect(JSON.stringify(pp.ngay_tao)).toMatch(/T00:00:00\.000Z"$/);
  });

  it('tiếng Việt không bị lỗi mã hóa', async () => {
    const row = await db.queryOne<{ ngon_ngu: string }>(
      "SELECT ngon_ngu FROM sach WHERE ma_sach = 'S001'",
    );
    expect(row?.ngon_ngu).toBe('Tiếng Việt');
  });

  it('LIMIT ? OFFSET ? và IN (?) hoạt động với query', async () => {
    const rows = await db.query(
      sql`SELECT id FROM sach WHERE ma_sach IN (${['S001', 'S002', 'S003']}) ORDER BY id LIMIT ${2} OFFSET ${1}`,
    );
    expect(rows).toHaveLength(2);
  });

  it('CALL trả tên cột thật (không còn f0, f1)', async () => {
    const rows = await db.call('sp_tra_cuu_sach', ['co so', 'SV001']);
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).toEqual(
      expect.arrayContaining(['ma_sach', 'ten_sach', 'so_ban_san_sang']),
    );
  });

  it('SIGNAL của procedure -> DatabaseError errno 1644 kèm thông báo nghiệp vụ', async () => {
    const err = await db.call('sp_thanh_toan_phat', ['999999']).catch((e) => e);
    expect(err).toBeInstanceOf(DatabaseError);
    expect(err.errno).toBe(1644);
    expect(err.sqlMessage).toContain('Phiếu phạt');
  });

  it('khóa ngoại và trùng khóa duy nhất ra đúng errno', async () => {
    const fk = await db
      .execute('DELETE FROM the_loai WHERE id = 1')
      .catch((e) => e);
    expect([1217, 1451]).toContain(fk.errno);
    const dup = await db
      .execute(
        "INSERT INTO the_loai (ma_the_loai, ten_the_loai) SELECT ma_the_loai, 'x' FROM the_loai WHERE id = 1",
      )
      .catch((e) => e);
    expect(dup.errno).toBe(1062);
  });

  it('UPDATE giữ nguyên giá trị vẫn tính là dòng khớp (FOUND_ROWS)', async () => {
    const res = await db.execute(
      'UPDATE the_loai SET ten_the_loai = ten_the_loai WHERE id = 1',
    );
    expect(res.affectedRows).toBe(1);
  });

  it('transaction: lỗi thì ROLLBACK, không để lại dòng', async () => {
    const ma = `TL${sfx}`;
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`INSERT INTO the_loai (ma_the_loai, ten_the_loai) VALUES (${ma}, ${'tmp'})`,
        );
        throw new Error('hủy');
      }),
    ).rejects.toThrow('hủy');
    expect(
      await db.query('SELECT id FROM the_loai WHERE ma_the_loai = ?', [ma]),
    ).toHaveLength(0);
  });

  it('transaction: thành công thì COMMIT, insertId dùng đọc lại được', async () => {
    const ma = `TM${sfx}`;
    const id = await db.transaction(async (tx) => {
      const res = await tx.execute(
        sql`INSERT INTO the_loai (ma_the_loai, ten_the_loai) VALUES (${ma}, ${'tmp'})`,
      );
      return String(res.insertId);
    });
    const row = await db.queryOne<{ ma_the_loai: string }>(
      'SELECT ma_the_loai FROM the_loai WHERE id = ?',
      [id],
    );
    expect(row?.ma_the_loai).toBe(ma);
    await db.execute('DELETE FROM the_loai WHERE id = ?', [id]);
  });

  it('procTransaction: autocommit tắt trong transaction và bật lại sau đó; lỗi thì ROLLBACK', async () => {
    const ma = `TP${sfx}`;
    await expect(
      db.procTransaction(async (tx) => {
        const [{ ac }] = await tx.query<{ ac: string }>(
          'SELECT @@autocommit AS ac',
        );
        expect(Number(ac)).toBe(0);
        await tx.execute(
          sql`INSERT INTO the_loai (ma_the_loai, ten_the_loai) VALUES (${ma}, ${'tmp'})`,
        );
        throw new Error('hủy');
      }),
    ).rejects.toThrow('hủy');
    expect(
      await db.query('SELECT id FROM the_loai WHERE ma_the_loai = ?', [ma]),
    ).toHaveLength(0);
    // connection trở về pool với autocommit = 1
    const rows = await Promise.all(
      Array.from({ length: 12 }, () =>
        db.queryOne<{ ac: string }>('SELECT @@autocommit AS ac'),
      ),
    );
    expect(rows.every((r) => Number(r?.ac) === 1)).toBe(true);
  });

  it('session: callback ném lỗi sau DML khi autocommit = 0 thì không lưu gì', async () => {
    const ma = `TS${sfx}`;
    await expect(
      db.session(async (conn) => {
        await conn.execute('SET autocommit = 0');
        await conn.execute(
          sql`INSERT INTO the_loai (ma_the_loai, ten_the_loai) VALUES (${ma}, ${'tmp'})`,
        );
        throw new Error('hủy');
      }),
    ).rejects.toThrow('hủy');
    expect(
      await db.query('SELECT id FROM the_loai WHERE ma_the_loai = ?', [ma]),
    ).toHaveLength(0);
  });

  it('session: DML rồi trả về bình thường mà chưa COMMIT thì cũng không lưu', async () => {
    const ma = `TU${sfx}`;
    await db.session(async (conn) => {
      await conn.execute('SET autocommit = 0');
      await conn.execute(
        sql`INSERT INTO the_loai (ma_the_loai, ten_the_loai) VALUES (${ma}, ${'tmp'})`,
      );
    });
    expect(
      await db.query('SELECT id FROM the_loai WHERE ma_the_loai = ?', [ma]),
    ).toHaveLength(0);
  });

  it('transaction: lỗi giữa chừng sau DML thì ROLLBACK, không để lại dữ liệu', async () => {
    const ma = `TC${sfx}`;
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`INSERT INTO the_loai (ma_the_loai, ten_the_loai) VALUES (${ma}, ${'tmp'})`,
        );
        await tx.execute(
          sql`INSERT INTO the_loai (ma_the_loai, ten_the_loai) VALUES (${ma}, ${'trung'})`,
        );
      }),
    ).rejects.toMatchObject({ errno: 1062 });
    expect(
      await db.query('SELECT id FROM the_loai WHERE ma_the_loai = ?', [ma]),
    ).toHaveLength(0);
  });

  it('session giữ biến @x giữa các câu lệnh (OUT param của procedure)', async () => {
    const out = await db.session(async (conn) => {
      await conn.execute("SET @x = 'abc'");
      return conn.queryOne<{ x: string }>('SELECT @x AS x');
    });
    expect(out?.x).toBe('abc');
  });
});

import {
  empty,
  ESCAPE_LIKE,
  join,
  likeContains,
  raw,
  sql,
  toStatement,
  where,
} from './sql.js';

describe('sql tagged template', () => {
  it('bind giá trị thành ? và giữ thứ tự tham số', () => {
    const q = sql`SELECT * FROM t WHERE a = ${1} AND b = ${'x'}`;
    expect(q.text).toBe('SELECT * FROM t WHERE a = ? AND b = ?');
    expect(q.params).toEqual([1, 'x']);
  });

  it('lồng fragment: gộp text và tham số theo đúng vị trí', () => {
    const cond = sql`b = ${2}`;
    const q = sql`SELECT * FROM t WHERE a = ${1} AND ${cond} LIMIT ${5}`;
    expect(q.text).toBe('SELECT * FROM t WHERE a = ? AND b = ? LIMIT ?');
    expect(q.params).toEqual([1, 2, 5]);
  });

  it('raw chèn nguyên văn, không thành tham số', () => {
    const q = sql`SELECT * FROM t ORDER BY ${raw('ten DESC')}`;
    expect(q.text).toBe('SELECT * FROM t ORDER BY ten DESC');
    expect(q.params).toEqual([]);
  });

  it('where: rỗng khi không có điều kiện, nối AND khi có', () => {
    expect(where([])).toBe(empty);
    const w = where([sql`a = ${1}`, sql`b = ${2}`]);
    expect(w.text).toBe('WHERE a = ? AND b = ?');
    expect(w.params).toEqual([1, 2]);
  });

  it('join nối fragment bằng dấu phân cách', () => {
    const j = join([sql`a = ${1}`, sql`b = ${2}`], ', ');
    expect(j.text).toBe('a = ?, b = ?');
    expect(j.params).toEqual([1, 2]);
  });

  it('mảng được giữ nguyên làm một tham số (mysql2 mở rộng IN (?))', () => {
    const q = sql`WHERE id IN (${[1, 2, 3]})`;
    expect(q.text).toBe('WHERE id IN (?)');
    expect(q.params).toEqual([[1, 2, 3]]);
  });

  it('likeContains escape % _ \\', () => {
    expect(likeContains('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
    expect(likeContains('abc')).toBe('%abc%');
  });

  it("ESCAPE_LIKE sinh ESCAPE '\\\\' trong SQL (một dấu \\)", () => {
    expect(sql`a LIKE ${'x'} ${ESCAPE_LIKE}`.text).toBe(
      "a LIKE ? ESCAPE '\\\\'",
    );
  });

  it('toStatement đổi undefined thành NULL và nhận cả chuỗi lẫn fragment', () => {
    expect(toStatement('SELECT ?', [undefined])).toEqual(['SELECT ?', [null]]);
    expect(toStatement(sql`SELECT ${undefined}`)).toEqual(['SELECT ?', [null]]);
  });
});

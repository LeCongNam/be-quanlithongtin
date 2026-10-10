import { parseDatabaseUrl, trimDecimal } from './db-config.js';

describe('trimDecimal', () => {
  it.each([
    ['85000.00', '85000'],
    ['12.50', '12.5'],
    ['0.00', '0'],
    ['1.05', '1.05'],
    ['100', '100'],
    ['100.10', '100.1'],
  ])('%s -> %s', (input, expected) => {
    expect(trimDecimal(input)).toBe(expected);
  });
});

describe('parseDatabaseUrl', () => {
  it('tách user, mật khẩu (giải mã %), host, port, database', () => {
    const o = parseDatabaseUrl(
      'mysql://qltt:p%40ss%2Fw@localhost:3307/qltv_nhom8',
    );
    expect(o).toMatchObject({
      host: 'localhost',
      port: 3307,
      user: 'qltt',
      password: 'p@ss/w',
      database: 'qltv_nhom8',
      charset: 'utf8mb4',
      timezone: 'Z',
      supportBigNumbers: true,
      bigNumberStrings: true,
    });
    expect(o.ssl).toBeUndefined();
  });

  it('port mặc định 3306', () => {
    expect(parseDatabaseUrl('mysql://u:p@h/db').port).toBe(3306);
  });

  it('ssl-mode=REQUIRED: mã hóa nhưng không kiểm chứng chứng chỉ', () => {
    const o = parseDatabaseUrl('mysql://u:p@h:21094/db?ssl-mode=REQUIRED');
    expect(o.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('ssl-mode=VERIFY_CA hoặc có CA: kiểm chứng chứng chỉ', () => {
    expect(parseDatabaseUrl('mysql://u:p@h/db?ssl-mode=VERIFY_CA').ssl).toEqual(
      { rejectUnauthorized: true },
    );
    expect(
      parseDatabaseUrl('mysql://u:p@h/db?ssl-mode=REQUIRED', { sslCa: 'PEM' })
        .ssl,
    ).toEqual({ ca: 'PEM', rejectUnauthorized: true });
  });

  it('ssl-mode=DISABLED: không dùng SSL', () => {
    expect(
      parseDatabaseUrl('mysql://u:p@h/db?ssl-mode=DISABLED').ssl,
    ).toBeUndefined();
  });

  it('từ chối URL không phải mysql://', () => {
    expect(() => parseDatabaseUrl('postgres://u:p@h/db')).toThrow(/mysql/);
  });

  it('typeCast bỏ số 0 thừa của DECIMAL, kiểu khác dùng mặc định', () => {
    const { typeCast } = parseDatabaseUrl('mysql://u:p@h/db');
    const next = () => 'mac-dinh';
    const decimal = (v: string | null) =>
      ({ type: 'NEWDECIMAL', string: () => v }) as never;
    expect((typeCast as Function)(decimal('85000.00'), next)).toBe('85000');
    expect((typeCast as Function)(decimal(null), next)).toBeNull();
    expect(
      (typeCast as Function)({ type: 'LONGLONG', string: () => '1' }, next),
    ).toBe('mac-dinh');
  });
});

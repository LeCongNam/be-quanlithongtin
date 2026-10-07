import { sortKetQuaTraCuu } from './sach.service.js';

const rows = [
  { ma_sach: 'S2', ten_sach: 'Toán rời rạc', nam_xuat_ban: 2022 },
  { ma_sach: 'S1', ten_sach: 'Đại số', nam_xuat_ban: null },
  { ma_sach: 'S3', ten_sach: 'Mạng máy tính', nam_xuat_ban: 2022 },
  { ma_sach: 'S4', ten_sach: 'Cơ sở dữ liệu', nam_xuat_ban: 2020 },
];
const ma = (r: typeof rows) => r.map((x) => x.ma_sach);

describe('sortKetQuaTraCuu', () => {
  it('theo tên, có dấu tiếng Việt', () => {
    expect(
      ma(sortKetQuaTraCuu(rows, { field: 'tenSach', dir: 'asc' })),
    ).toEqual(['S4', 'S1', 'S3', 'S2']);
  });

  it('giảm dần', () => {
    expect(
      ma(sortKetQuaTraCuu(rows, { field: 'tenSach', dir: 'desc' })),
    ).toEqual(['S2', 'S3', 'S1', 'S4']);
  });

  it('ô trống luôn cuối ở cả hai chiều, hòa thì theo ma_sach', () => {
    expect(
      ma(sortKetQuaTraCuu(rows, { field: 'namXuatBan', dir: 'asc' })),
    ).toEqual(['S4', 'S2', 'S3', 'S1']);
    expect(
      ma(sortKetQuaTraCuu(rows, { field: 'namXuatBan', dir: 'desc' })),
    ).toEqual(['S2', 'S3', 'S4', 'S1']);
  });

  it('không làm đổi mảng gốc', () => {
    const goc = ma(rows);
    sortKetQuaTraCuu(rows, { field: 'tenSach', dir: 'desc' });
    expect(ma(rows)).toEqual(goc);
  });
});

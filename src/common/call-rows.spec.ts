import { namedRows } from './call-rows.js';

describe('namedRows', () => {
  it('gán lại tên cột từ f0..fN và ép kiểu số cho cột chỉ định', () => {
    const rows = [{ f0: 'S001', f1: '11', f2: null }];
    expect(
      namedRows(rows, ['ma_sach', 'so_ngay', 'ghi_chu'] as const, ['so_ngay']),
    ).toEqual([{ ma_sach: 'S001', so_ngay: 11, ghi_chu: null }]);
  });

  it('trả mảng rỗng khi không có dòng', () => {
    expect(namedRows([], ['a'] as const)).toEqual([]);
  });
});

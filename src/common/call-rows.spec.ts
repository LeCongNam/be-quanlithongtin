import { numberColumns } from './call-rows.js';

describe('numberColumns', () => {
  it('ép chuỗi của cột chỉ định về number, giữ nguyên null và cột khác', () => {
    const rows = [{ ma: 'S001', so_ngay: '11', tong: null, khoa: '7' }];
    expect(numberColumns(rows, ['so_ngay', 'tong'])).toEqual([
      { ma: 'S001', so_ngay: 11, tong: null, khoa: '7' },
    ]);
  });

  it('trả mảng rỗng khi không có dòng', () => {
    expect(numberColumns([], ['a'])).toEqual([]);
  });
});

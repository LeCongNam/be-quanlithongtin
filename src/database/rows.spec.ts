import { camelize, insertInto, toCamel, toSnake, updateTable } from './rows.js';
import { sql } from './sql.js';

describe('toCamel / toSnake', () => {
  it.each([
    ['ma_nguoi_dung', 'maNguoiDung'],
    ['ct_phieu_muon_id', 'ctPhieuMuonId'],
    ['ma_nxb', 'maNxb'],
    ['email', 'email'],
  ])('%s <-> %s', (snake, camel) => {
    expect(toCamel(snake)).toBe(camel);
    expect(toSnake(camel)).toBe(snake);
  });

  it('camelize đổi khóa nhưng giữ giá trị', () => {
    const d = new Date();
    expect(camelize({ ma_sach: 'S1', created_at: d, id: '1' })).toEqual({
      maSach: 'S1',
      createdAt: d,
      id: '1',
    });
  });
});

describe('insertInto', () => {
  it('chỉ ghi field có trong whitelist và đã khai báo (null được giữ)', () => {
    const q = insertInto('nha_xuat_ban', ['maNxb', 'tenNxb', 'diaChi', 'sdt'], {
      maNxb: 'N1',
      tenNxb: 'T',
      diaChi: null,
      sdt: undefined,
      khongCoTrongWhitelist: 'x',
    });
    expect(q.text.replace(/\s+/g, ' ')).toBe(
      'INSERT INTO nha_xuat_ban (ma_nxb, ten_nxb, dia_chi) VALUES (?, ?, ?)',
    );
    expect(q.params).toEqual(['N1', 'T', null]);
  });
});

describe('updateTable', () => {
  it('SET các field đã khai báo, bỏ undefined', () => {
    const q = updateTable(
      'tac_gia',
      ['tenTacGia', 'quocTich', 'namSinh'],
      { tenTacGia: 'A', quocTich: null, namSinh: undefined },
      sql`id = ${5n}`,
    );
    expect(q.text).toBe(
      'UPDATE tac_gia SET ten_tac_gia = ?, quoc_tich = ? WHERE id = ?',
    );
    expect(q.params).toEqual(['A', null, 5n]);
  });

  it('không có field nào thì SET id = id', () => {
    const q = updateTable('tac_gia', ['tenTacGia'], {}, sql`id = ${1}`);
    expect(q.text).toBe('UPDATE tac_gia SET id = id WHERE id = ?');
  });
});

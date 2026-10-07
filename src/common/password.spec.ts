import { hashMatKhau, khopMatKhau } from './password.js';

describe('password', () => {
  it('SHA-256(muoi + mat_khau) dạng hex thường, như SHA2(CONCAT(muoi, mat_khau), 256) của MySQL', () => {
    // SHA256('abc') chuẩn
    expect(hashMatKhau('a', 'bc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('khớp đúng mật khẩu, không phân biệt hoa thường của hash lưu trong DB', () => {
    const hash = hashMatKhau('muoi123', 'Mật-Khẩu-1');
    expect(khopMatKhau('muoi123', 'Mật-Khẩu-1', hash)).toBe(true);
    expect(khopMatKhau('muoi123', 'Mật-Khẩu-1', hash.toUpperCase())).toBe(true);
  });

  it('từ chối sai mật khẩu, sai muối và hash không phải SHA2 (bcrypt)', () => {
    const hash = hashMatKhau('muoi123', 'Mat-Khau-1');
    expect(khopMatKhau('muoi123', 'sai', hash)).toBe(false);
    expect(khopMatKhau('muoi-khac', 'Mat-Khau-1', hash)).toBe(false);
    expect(khopMatKhau('muoi123', 'Mat-Khau-1', '$2b$10$abc')).toBe(false);
  });
});

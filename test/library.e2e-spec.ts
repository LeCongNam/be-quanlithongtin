import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import '../src/common/bigint-json.js';

/**
 * Chạy trên DB thật (docker compose up -d db) với dữ liệu seed trong sql/02_seed.sql.
 * Mỗi lần chạy tự tạo dữ liệu mới với mã duy nhất nên chạy lại nhiều lần được;
 * dữ liệu test không bị dọn (phiếu mượn/phạt có khóa ngoại). Muốn DB sạch: docker compose down -v && up.
 */
const ADMIN = {
  tenDangNhap: process.env.E2E_ADMIN_USER ?? 'ad001',
  matKhau: process.env.E2E_ADMIN_PASSWORD ?? 'AD001@Nhom8',
};
const sfx = Date.now().toString(36).toUpperCase().slice(-7);
const READER_A = `EA${sfx}`;
const READER_B = `EB${sfx}`;
const PASSWORD = 'MatKhau-Test-1';

describe('Library API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let admin: string;
  let readerA: string;
  let readerB: string;
  const ids: Record<string, string> = {};
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (tenDangNhap: string, matKhau: string) => {
    const res = await http
      .post('/auth/login')
      .send({ tenDangNhap, matKhau })
      .expect(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    http = request(app.getHttpServer());
    admin = await login(ADMIN.tenDangNhap, ADMIN.matKhau);

    // Dữ liệu: 2 bạn đọc có tài khoản, 1 sách (2 bản), 1 sách (1 bản)
    for (const ma of [READER_A, READER_B]) {
      const dg = await http
        .post('/docgia')
        .set(auth(admin))
        .send({
          maNguoiDung: ma,
          hoTen: `Doc gia ${ma}`,
          loaiNguoiDung: 'SINH_VIEN',
          trangThai: 'HOAT_DONG',
        })
        .expect(201);
      await http
        .post(`/docgia/${dg.body.id}/tai-khoan`)
        .set(auth(admin))
        .send({ matKhau: PASSWORD })
        .expect(201);
    }
    readerA = await login(READER_A.toLowerCase(), PASSWORD);
    readerB = await login(READER_B.toLowerCase(), PASSWORD);

    const tl = await http
      .post('/the-loai')
      .set(auth(admin))
      .send({ maTheLoai: `TL${sfx}`, tenTheLoai: 'The loai test' })
      .expect(201);
    const nxb = await http
      .post('/nha-xuat-ban')
      .set(auth(admin))
      .send({ maNxb: `NXB${sfx}`, tenNxb: 'NXB test' })
      .expect(201);
    const tg = await http
      .post('/tac-gia')
      .set(auth(admin))
      .send({ maTacGia: `TG${sfx}`, tenTacGia: 'Tac gia test', namSinh: 1980 })
      .expect(201);
    for (const [key, ma, soBan] of [
      ['s1', `SA${sfx}`, 2],
      ['s2', `SB${sfx}`, 1],
    ] as const) {
      const sach = await http
        .post('/sach')
        .set(auth(admin))
        .send({
          maSach: ma,
          tenSach: `Sach test ${ma}`,
          theLoaiId: Number(tl.body.id),
          nxbId: Number(nxb.body.id),
          tacGiaIds: [Number(tg.body.id)],
          giaBia: 100000,
        })
        .expect(201);
      ids[key] = ma;
      for (let i = 1; i <= soBan; i++) {
        await http
          .post(`/sach/${sach.body.id}/ban-sach`)
          .set(auth(admin))
          .send({
            maBanSach: `${ma}-${i}`,
            viTriKe: 'K-TEST',
            ngayNhap: '2026-01-01',
          })
          .expect(201);
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('xác thực và phân quyền', () => {
    it('chặn khi thiếu token hoặc sai mật khẩu', async () => {
      await http.get('/docgia').expect(401);
      await http
        .post('/auth/login')
        .send({ tenDangNhap: ADMIN.tenDangNhap, matKhau: 'sai' })
        .expect(401);
    });

    it('bạn đọc không vào được khu vực thủ thư', async () => {
      await http.get('/docgia').set(auth(readerA)).expect(403);
      await http.get('/bao-cao/muon-qua-han').set(auth(readerA)).expect(403);
      await http.post('/sach').set(auth(readerA)).send({}).expect(403);
    });

    it('validate DTO và id BigInt', async () => {
      await http
        .post('/docgia')
        .set(auth(admin))
        .send({ maNguoiDung: '' })
        .expect(400);
      await http.get('/sach/abc').set(auth(admin)).expect(400);
    });

    it('lỗi trùng khóa -> 409, không có bản ghi -> 404', async () => {
      await http
        .post('/the-loai')
        .set(auth(admin))
        .send({ maTheLoai: `TL${sfx}`, tenTheLoai: 'trung' })
        .expect(409);
      await http.get('/sach/999999999').set(auth(admin)).expect(404);
    });
  });

  describe('tra cứu sách', () => {
    it('tìm theo từ khóa gọi sp_tra_cuu_sach', async () => {
      const res = await http
        .get('/sach')
        .query({ tuKhoa: ids.s1 })
        .set(auth(readerA))
        .expect(200);
      expect(
        res.body.data.map((r: { ma_sach: string }) => r.ma_sach),
      ).toContain(ids.s1);
    });
  });

  describe('mượn - gia hạn - trả - phạt', () => {
    let maPhieu: string;

    it('thủ thư lập phiếu mượn cho bạn đọc A', async () => {
      const res = await http
        .post('/phieu-muon')
        .set(auth(admin))
        .send({ maNguoiDung: READER_A, maBanSachs: [`${ids.s1}-1`] })
        .expect(201);
      maPhieu = res.body.maPhieu;
      expect(res.body.trangThai).toBe('DANG_MUON');
      expect(res.body.ctPhieuMuons).toHaveLength(1);
    });

    it('một bản sách không thể cho mượn hai lần (lỗi nghiệp vụ DB -> 422, không để lại phiếu rỗng)', async () => {
      const before = await http
        .get('/phieu-muon')
        .query({ maNguoiDung: READER_B })
        .set(auth(admin))
        .expect(200);
      const res = await http
        .post('/phieu-muon')
        .set(auth(admin))
        .send({ maNguoiDung: READER_B, maBanSachs: [`${ids.s1}-1`] })
        .expect(422);
      expect(res.body.message).toBeTruthy();
      const after = await http
        .get('/phieu-muon')
        .query({ maNguoiDung: READER_B })
        .set(auth(admin))
        .expect(200);
      expect(after.body.total).toBe(before.body.total);
    });

    it('bạn đọc chỉ xem được phiếu của mình và thấy sách đang mượn', async () => {
      await http.get(`/phieu-muon/${maPhieu}`).set(auth(readerA)).expect(200);
      await http.get(`/phieu-muon/${maPhieu}`).set(auth(readerB)).expect(403);
      const res = await http
        .get('/me/sach-dang-muon')
        .set(auth(readerA))
        .expect(200);
      expect(
        res.body.map((r: { ma_ban_sach: string }) => r.ma_ban_sach),
      ).toContain(`${ids.s1}-1`);
    });

    it('gia hạn 1 lần được, lần hai bị từ chối; không gia hạn hộ người khác', async () => {
      await http
        .post('/muon-tra/gia-han')
        .set(auth(readerB))
        .send({ maBanSach: `${ids.s1}-1`, soNgay: 3 })
        .expect(403);
      const ok = await http
        .post('/muon-tra/gia-han')
        .set(auth(readerA))
        .send({ maBanSach: `${ids.s1}-1`, soNgay: 3 })
        .expect(200);
      expect(ok.body.soLanGiaHan).toBe(1);
      await http
        .post('/muon-tra/gia-han')
        .set(auth(readerA))
        .send({ maBanSach: `${ids.s1}-1`, soNgay: 3 })
        .expect(422);
    });

    it('trả bình thường: phiếu hoàn tất, không phát sinh phạt', async () => {
      const res = await http
        .post('/muon-tra/tra')
        .set(auth(admin))
        .send({ maBanSach: `${ids.s1}-1` })
        .expect(200);
      expect(res.body.ngayTra).toBeTruthy();
      expect(res.body.phieuPhats).toHaveLength(0);
      const phieu = await http
        .get(`/phieu-muon/${maPhieu}`)
        .set(auth(admin))
        .expect(200);
      expect(phieu.body.trangThai).toBe('HOAN_TAT');
    });

    it('làm mất sách -> phiếu phạt MAT_SACH, chặn mượn tiếp, thanh toán xong được mượn lại', async () => {
      await http
        .post('/phieu-muon')
        .set(auth(admin))
        .send({ maNguoiDung: READER_A, maBanSachs: [`${ids.s1}-2`] })
        .expect(201);
      const tra = await http
        .post('/muon-tra/tra')
        .set(auth(admin))
        .send({ maBanSach: `${ids.s1}-2`, tinhTrang: 'MAT' })
        .expect(200);
      const phat = tra.body.phieuPhats[0];
      expect(phat.loaiPhat).toBe('MAT_SACH');
      expect(Number(phat.soTien)).toBeGreaterThanOrEqual(300000);

      const own = await http
        .get('/me/tien-phat')
        .set(auth(readerA))
        .expect(200);
      expect(
        own.body.some(
          (r: { trang_thai: string }) => r.trang_thai === 'CHUA_THANH_TOAN',
        ),
      ).toBe(true);
      await http
        .post('/phieu-muon')
        .set(auth(admin))
        .send({ maNguoiDung: READER_A, maBanSachs: [`${ids.s2}-1`] })
        .expect(422);

      await http
        .post(`/phat/${phat.id}/huy`)
        .set(auth(readerA))
        .send({ lyDo: 'x' })
        .expect(403);
      const paid = await http
        .post(`/phat/${phat.id}/thanh-toan`)
        .set(auth(admin))
        .expect(200);
      expect(paid.body.trangThai).toBe('DA_THANH_TOAN');
      await http
        .post('/phieu-muon')
        .set(auth(admin))
        .send({ maNguoiDung: READER_A, maBanSachs: [`${ids.s2}-1`] })
        .expect(201);
    });
  });

  describe('đặt trước', () => {
    it('sách còn bản sẵn sàng thì không cần đặt trước', async () => {
      await http
        .post('/dat-truoc')
        .set(auth(readerB))
        .send({ maSach: ids.s1 })
        .expect(422);
    });

    it('sách đã hết bản: đặt được, bạn đọc không đặt hộ người khác, hủy được', async () => {
      // s2 chỉ có 1 bản và READER_A đang mượn
      await http
        .post('/dat-truoc')
        .set(auth(readerB))
        .send({ maSach: ids.s2, maNguoiDung: READER_A })
        .expect(403);
      const res = await http
        .post('/dat-truoc')
        .set(auth(readerB))
        .send({ maSach: ids.s2 })
        .expect(201);
      expect(res.body.trangThai).toBe('CHO_XU_LY');
      expect(res.body.nguoiDung.maNguoiDung).toBe(READER_B);

      const mine = await http.get('/dat-truoc').set(auth(readerB)).expect(200);
      expect(
        mine.body.data.every(
          (d: { nguoiDung: { maNguoiDung: string } }) =>
            d.nguoiDung.maNguoiDung === READER_B,
        ),
      ).toBe(true);

      await http.delete(`/dat-truoc/${ids.s2}`).set(auth(readerB)).expect(200);
    });
  });

  describe('báo cáo', () => {
    it.each([
      'danh-muc-sach',
      'sach-dang-muon',
      'muon-qua-han',
      'nguoi-dung-vi-pham',
      'top-sach-muon-nhieu',
    ])('GET /bao-cao/%s trả mảng', async (name) => {
      const res = await http
        .get(`/bao-cao/${name}`)
        .set(auth(admin))
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});

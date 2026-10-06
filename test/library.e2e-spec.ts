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
const THU_THU = {
  tenDangNhap: process.env.E2E_THU_THU_USER ?? 'cb001',
  matKhau: process.env.E2E_THU_THU_PASSWORD ?? 'CB001@Nhom8',
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
  let thuThu: string;
  const ids: Record<string, string> = {};
  const sachIds: Record<string, string> = {};
  const docgiaIds: Record<string, string> = {};
  /** Mã bản sách do sp_them_ban_sach sinh (BSnnn) */
  const bs: Record<string, string[]> = {};
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
    thuThu = await login(THU_THU.tenDangNhap, THU_THU.matKhau);

    // Dữ liệu: 2 bạn đọc có tài khoản, 1 sách (2 bản), 1 sách (1 bản)
    for (const ma of [READER_A, READER_B]) {
      const dg = await http
        .post('/docgia')
        .set(auth(admin))
        .send({
          maNguoiDung: ma,
          hoTen: `Doc gia ${ma}`,
          loaiNguoiDung: 'SINH_VIEN',
        })
        .expect(201);
      expect(dg.body.trangThai).toBe('HOAT_DONG');
      docgiaIds[ma] = dg.body.id;
      await http
        .post(`/docgia/${dg.body.id}/tai-khoan`)
        .set(auth(admin))
        .send({ matKhau: PASSWORD })
        .expect(201);
    }
    readerA = await login(READER_A.toLowerCase(), PASSWORD);
    readerB = await login(READER_B.toLowerCase(), PASSWORD);

    await http
      .post('/the-loai')
      .set(auth(admin))
      .send({ maTheLoai: `TL${sfx}`, tenTheLoai: 'The loai test' })
      .expect(201);
    await http
      .post('/nha-xuat-ban')
      .set(auth(admin))
      .send({ maNxb: `NXB${sfx}`, tenNxb: 'NXB test' })
      .expect(201);
    await http
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
          maTheLoai: `TL${sfx}`,
          maNxb: `NXB${sfx}`,
          maTacGias: [`TG${sfx}`],
          giaBia: 100000,
        })
        .expect(201);
      expect(sach.body.sachTacGias).toHaveLength(1);
      ids[key] = ma;
      sachIds[key] = sach.body.id;
      const ban = await http
        .post(`/sach/${sach.body.id}/ban-sach`)
        .set(auth(admin))
        .send({ soBan, viTriKe: 'K-TEST' })
        .expect(201);
      expect(ban.body).toHaveLength(soBan);
      bs[key] = ban.body.map((b: { ma_ban_sach: string }) => b.ma_ban_sach);
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

    it('thêm sách với mã tác giả không tồn tại -> 422, không thêm gì', async () => {
      await http
        .post('/sach')
        .set(auth(admin))
        .send({
          maSach: `SX${sfx}`,
          tenSach: 'Sach loi',
          maTheLoai: `TL${sfx}`,
          maNxb: `NXB${sfx}`,
          maTacGias: [`TG${sfx}`, 'KHONG_CO'],
        })
        .expect(422);
      const res = await http
        .get('/sach')
        .query({ tuKhoa: `SX${sfx}` })
        .set(auth(admin))
        .expect(200);
      expect(res.body.data).toHaveLength(0);
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

    it('tìm tiếng Việt (FULLTEXT ngram) và ký tự đại diện được hiểu theo nghĩa đen', async () => {
      const coSo = await http
        .get('/sach')
        .query({ tuKhoa: 'cơ sở' })
        .set(auth(readerA))
        .expect(200);
      expect(coSo.body.data.map((r: { ma_sach: string }) => r.ma_sach)).toEqual(
        expect.arrayContaining(['S001', 'S002']),
      );
      const percent = await http
        .get('/sach')
        .query({ tuKhoa: '%' })
        .set(auth(readerA))
        .expect(200);
      expect(percent.body.data).toHaveLength(0);
      const blank = await http
        .get('/sach')
        .query({ tuKhoa: '   ' })
        .set(auth(readerA))
        .expect(200);
      expect(blank.body.total).toBeGreaterThan(0);
    });
  });

  describe('mượn - gia hạn - trả - phạt', () => {
    let maPhieu: string;

    it('thủ thư lập phiếu mượn cho bạn đọc A', async () => {
      const res = await http
        .post('/phieu-muon')
        .set(auth(admin))
        .send({ maNguoiDung: READER_A, maBanSachs: [bs.s1[0]] })
        .expect(201);
      maPhieu = res.body.maPhieu;
      expect(res.body.trangThai).toBe('DANG_MUON');
      expect(res.body.ctPhieuMuons).toHaveLength(1);
    });

    it('một bản sách không thể cho mượn hai lần (422); cả phiếu được hoàn tác, kể cả cuốn hợp lệ ghi trước', async () => {
      const before = await http
        .get('/phieu-muon')
        .query({ maNguoiDung: READER_B })
        .set(auth(admin))
        .expect(200);
      const res = await http
        .post('/phieu-muon')
        .set(auth(admin))
        .send({ maNguoiDung: READER_B, maBanSachs: [bs.s1[1], bs.s1[0]] })
        .expect(422);
      expect(res.body.message).toBeTruthy();
      const after = await http
        .get('/phieu-muon')
        .query({ maNguoiDung: READER_B })
        .set(auth(admin))
        .expect(200);
      expect(after.body.total).toBe(before.body.total);
      // procedure tự COMMIT nếu bị bọc bằng $transaction trần: bản thứ nhất sẽ kẹt ở DANG_MUON
      const banSach = await http
        .get(`/sach/${sachIds.s1}/ban-sach`)
        .set(auth(admin))
        .expect(200);
      const ban1 = banSach.body.find(
        (b: { maBanSach: string }) => b.maBanSach === bs.s1[1],
      );
      expect(ban1.tinhTrang).toBe('SAN_SANG');
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
      ).toContain(bs.s1[0]);
    });

    it('gia hạn 1 lần được, lần hai bị từ chối; không gia hạn hộ người khác', async () => {
      // sp_gia_han_luot_muon: sách của người khác bị báo như không có lượt mượn
      await http
        .post('/muon-tra/gia-han')
        .set(auth(readerB))
        .send({ maBanSach: bs.s1[0], soNgay: 3 })
        .expect(422);
      const ok = await http
        .post('/muon-tra/gia-han')
        .set(auth(readerA))
        .send({ maBanSach: bs.s1[0], soNgay: 3 })
        .expect(200);
      expect(ok.body.soLanGiaHan).toBe(1);
      await http
        .post('/muon-tra/gia-han')
        .set(auth(readerA))
        .send({ maBanSach: bs.s1[0], soNgay: 3 })
        .expect(422);
    });

    it('trả bình thường: phiếu hoàn tất, không phát sinh phạt', async () => {
      const res = await http
        .post('/muon-tra/tra')
        .set(auth(admin))
        .send({ maBanSach: bs.s1[0] })
        .expect(200);
      expect(res.body.ngayTra).toBeTruthy();
      expect(res.body.phieuPhats).toHaveLength(0);
      const phieu = await http
        .get(`/phieu-muon/${maPhieu}`)
        .set(auth(admin))
        .expect(200);
      expect(phieu.body.trangThai).toBe('HOAN_TAT');

      const lichSu = await http
        .get('/me/lich-su-muon')
        .set(auth(readerA))
        .expect(200);
      const luot = lichSu.body.find(
        (r: { ma_ban_sach: string }) => r.ma_ban_sach === bs.s1[0],
      );
      expect(luot.ngay_tra).toBeTruthy();
      expect(luot.so_lan_gia_han).toBe(1);
      expect(luot.tinh_trang_tra).toBe('BINH_THUONG');
    });

    it('làm mất sách -> phiếu phạt MAT_SACH, chặn mượn tiếp, thanh toán xong được mượn lại', async () => {
      await http
        .post('/phieu-muon')
        .set(auth(admin))
        .send({ maNguoiDung: READER_A, maBanSachs: [bs.s1[1]] })
        .expect(201);
      const tra = await http
        .post('/muon-tra/tra')
        .set(auth(admin))
        .send({ maBanSach: bs.s1[1], tinhTrang: 'MAT' })
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
        .send({ maNguoiDung: READER_A, maBanSachs: [bs.s2[0]] })
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
        .send({ maNguoiDung: READER_A, maBanSachs: [bs.s2[0]] })
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

      const meDat = await http
        .get('/me/dat-truoc')
        .set(auth(readerB))
        .expect(200);
      expect(meDat.body[0]).toMatchObject({
        ma_sach: ids.s2,
        trang_thai: 'CHO_XU_LY',
        thu_tu_cho: 1,
      });

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

  describe('trạng thái người dùng và tài khoản', () => {
    it('tạm khóa bạn đọc khóa luôn tài khoản; mở lại người dùng không tự mở tài khoản', async () => {
      const id = docgiaIds[READER_B];
      const khoa = await http
        .patch(`/docgia/${id}/trang-thai`)
        .set(auth(thuThu))
        .send({ trangThai: 'TAM_KHOA' })
        .expect(200);
      expect(khoa.body.taiKhoan.trangThai).toBe('KHOA');
      await http
        .post('/auth/login')
        .send({ tenDangNhap: READER_B.toLowerCase(), matKhau: PASSWORD })
        .expect(401);

      // chỉ quản trị mở được tài khoản, và chỉ khi người dùng đã HOAT_DONG
      await http
        .patch(`/docgia/${id}/tai-khoan/trang-thai`)
        .set(auth(thuThu))
        .send({ trangThai: 'HOAT_DONG' })
        .expect(403);
      await http
        .patch(`/docgia/${id}/tai-khoan/trang-thai`)
        .set(auth(admin))
        .send({ trangThai: 'HOAT_DONG' })
        .expect(422);

      const mo = await http
        .patch(`/docgia/${id}/trang-thai`)
        .set(auth(thuThu))
        .send({ trangThai: 'HOAT_DONG' })
        .expect(200);
      expect(mo.body.taiKhoan.trangThai).toBe('KHOA');
      await http
        .patch(`/docgia/${id}/tai-khoan/trang-thai`)
        .set(auth(admin))
        .send({ trangThai: 'HOAT_DONG' })
        .expect(200);
      await login(READER_B.toLowerCase(), PASSWORD);
    });

    it('đổi sang trạng thái đang có -> 422; thủ thư không đổi được cán bộ', async () => {
      await http
        .patch(`/docgia/${docgiaIds[READER_B]}/trang-thai`)
        .set(auth(thuThu))
        .send({ trangThai: 'HOAT_DONG' })
        .expect(422);
      const canBo = await http
        .get('/docgia')
        .query({ loaiNguoiDung: 'CAN_BO', tuKhoa: 'AD001' })
        .set(auth(thuThu))
        .expect(200);
      await http
        .patch(`/docgia/${canBo.body.data[0].id}/trang-thai`)
        .set(auth(thuThu))
        .send({ trangThai: 'TAM_KHOA' })
        .expect(403);
    });
  });

  describe('báo cáo', () => {
    it.each([
      'danh-muc-sach',
      'sach-dang-muon',
      'muon-qua-han',
      'nguoi-dung-vi-pham',
      'top-sach-muon-nhieu',
      'thong-ke-tien-phat',
      'lich-su-muon',
      'dat-truoc',
    ])('GET /bao-cao/%s trả mảng', async (name) => {
      const res = await http
        .get(`/bao-cao/${name}`)
        .set(auth(admin))
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('lọc lịch sử mượn và đặt trước theo người dùng', async () => {
      const lichSu = await http
        .get('/bao-cao/lich-su-muon')
        .query({ maNguoiDung: READER_A })
        .set(auth(admin))
        .expect(200);
      expect(lichSu.body.length).toBeGreaterThan(0);
      expect(
        lichSu.body.every(
          (r: { ma_nguoi_dung: string }) => r.ma_nguoi_dung === READER_A,
        ),
      ).toBe(true);
      const datTruoc = await http
        .get('/bao-cao/dat-truoc')
        .query({ maNguoiDung: READER_B, trangThai: 'HUY' })
        .set(auth(admin))
        .expect(200);
      expect(datTruoc.body).toHaveLength(1);
    });
  });
});

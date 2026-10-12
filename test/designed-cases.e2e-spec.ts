import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import '../src/common/bigint-json.js';
import { DbService } from '../src/database/db.service.js';

/**
 * Tự động hóa các case DESIGNED trong TEST_CASES_FULL.md (tên mỗi test bắt đầu bằng mã case).
 * Chạy trên DB local có seed; mọi dữ liệu tạo ra dùng mã duy nhất theo `sfx` nên chạy lại được
 * (không dọn: phiếu mượn/phạt có khóa ngoại). Guard ở test/setup-db-guard.ts chặn DB từ xa.
 */
const sfx = Date.now().toString(36).toUpperCase().slice(-7);
const PASSWORD = 'MatKhau-Test-1';
const ADMIN = { tenDangNhap: 'ad001', matKhau: 'AD001@Nhom8' };
const THU_THU = { tenDangNhap: 'cb001', matKhau: 'CB001@Nhom8' };
const ID_KHONG_CO = '999999999';

type Body = Record<string, any>;

describe('Các case DESIGNED (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DbService;
  let admin: string;
  let thuThu: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const soSanhChuoi = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

  const login = async (tenDangNhap: string, matKhau: string) => {
    const res = await http
      .post('/auth/login')
      .send({ tenDangNhap, matKhau })
      .expect(200);
    return res.body.accessToken as string;
  };

  const dem = async (
    bang: string,
    dieuKien = '1=1',
    params: unknown[] = [],
  ) => {
    const [{ n }] = await db.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM ${bang} WHERE ${dieuKien}`,
      params,
    );
    return Number(n);
  };

  /** Tạo bạn đọc (kèm tài khoản, đăng nhập được bằng mã viết thường). */
  const taoBanDoc = async (ma: string, hoTen = `Doc gia ${ma}`) => {
    const dg = await http
      .post('/docgia')
      .set(auth(admin))
      .send({ maNguoiDung: ma, hoTen, loaiNguoiDung: 'SINH_VIEN' })
      .expect(201);
    await http
      .post(`/docgia/${dg.body.id}/tai-khoan`)
      .set(auth(admin))
      .send({ matKhau: PASSWORD })
      .expect(201);
    return {
      ma,
      id: dg.body.id as string,
      token: await login(ma.toLowerCase(), PASSWORD),
    };
  };

  const taoDanhMuc = async (loai: 'TL' | 'NXB' | 'TG', hau: string) => {
    const ma = `${loai}${hau}${sfx}`;
    const route = { TL: 'the-loai', NXB: 'nha-xuat-ban', TG: 'tac-gia' }[loai];
    const body = {
      TL: { maTheLoai: ma, tenTheLoai: `The loai ${ma}` },
      NXB: { maNxb: ma, tenNxb: `NXB ${ma}` },
      TG: { maTacGia: ma, tenTacGia: `Tac gia ${ma}` },
    }[loai];
    const res = await http
      .post(`/${route}`)
      .set(auth(admin))
      .send(body)
      .expect(201);
    return { ma, id: res.body.id as string };
  };

  let tl1: { ma: string; id: string };
  let nxb1: { ma: string; id: string };
  let tg1: { ma: string; id: string };

  /** Tạo đầu sách (+ số bản nếu > 0). */
  const taoSach = async (
    ma: string,
    soBan: number,
    extra: Body = {},
  ): Promise<{ ma: string; id: string; bans: string[] }> => {
    const sach = await http
      .post('/sach')
      .set(auth(admin))
      .send({
        maSach: ma,
        tenSach: `Sach test ${ma}`,
        maTheLoai: tl1.ma,
        maNxb: nxb1.ma,
        maTacGias: [tg1.ma],
        giaBia: 100000,
        ...extra,
      })
      .expect(201);
    let bans: string[] = [];
    if (soBan > 0) {
      const ban = await http
        .post(`/sach/${sach.body.id}/ban-sach`)
        .set(auth(admin))
        .send({ soBan, viTriKe: 'K-DESIGNED' })
        .expect(201);
      bans = ban.body.map((b: { ma_ban_sach: string }) => b.ma_ban_sach);
    }
    return { ma, id: sach.body.id, bans };
  };

  const muon = (maNguoiDung: string, maBanSachs: string[], token = thuThu) =>
    http.post('/phieu-muon').set(auth(token)).send({ maNguoiDung, maBanSachs });

  const tra = (maBanSach: string, tinhTrang?: string, token = thuThu) =>
    http
      .post('/muon-tra/tra')
      .set(auth(token))
      .send({ maBanSach, ...(tinhTrang && { tinhTrang }) });

  const tinhTrangBan = async (maBanSach: string) =>
    (await http.get(`/ban-sach/${maBanSach}`).set(auth(admin)).expect(200)).body
      .tinhTrang as string;

  /** Kho bản sách dùng cho các kịch bản mượn/trả (mỗi bản dùng một lần). */
  const kho: string[] = [];
  /** Bạn đọc dùng chung cho các kiểm tra 403 và tìm tên có dấu. */
  let docGiaChung: { ma: string; id: string; token: string };
  const readerOf = () => docGiaChung.token;
  const layBan = () => {
    const ma = kho.shift();
    if (!ma) throw new Error('Hết bản sách trong kho test');
    return ma;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    // Nghe sẵn trên 127.0.0.1: tránh trùng cổng với tiến trình khác trên máy dev (xem ghi chú ở library.e2e-spec.ts).
    await app.listen(0, '127.0.0.1');
    http = request(app.getHttpServer());
    db = app.get(DbService);
    admin = await login(ADMIN.tenDangNhap, ADMIN.matKhau);
    thuThu = await login(THU_THU.tenDangNhap, THU_THU.matKhau);
    tl1 = await taoDanhMuc('TL', '1');
    nxb1 = await taoDanhMuc('NXB', '1');
    tg1 = await taoDanhMuc('TG', '1');
    const khoSach = await taoSach(`SK${sfx}`, 40);
    kho.push(...khoSach.bans);
    docGiaChung = await taoBanDoc(`DZ${sfx}`, `Nguyễn Văn Ân ${sfx}`);
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------- AUTH
  describe('AUTH', () => {
    const payload = {
      nguoiDungId: '1',
      maNguoiDung: 'AD001',
      tenDangNhap: 'ad001',
      vaiTro: 'ADMIN',
    };
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');

    it('AUTH-10 JWT rác / sai chữ ký / hết hạn / alg none / người dùng không tồn tại -> 401', async () => {
      const secret = app.get(ConfigService).getOrThrow<string>('JWT_SECRET');
      const jwt = app.get(JwtService);
      // JwtService của app đặt sẵn expiresIn nên không cho payload tự mang exp: dùng bản không có signOptions
      const hetHan = await new JwtService({ secret }).signAsync({
        ...payload,
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      const saiChuKy = await new JwtService({
        secret: 'khong-phai-secret',
      }).signAsync(payload);
      const khongTonTai = await jwt.signAsync(
        { ...payload, nguoiDungId: ID_KHONG_CO, maNguoiDung: `KHONG${sfx}` },
        { secret },
      );
      const algNone = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;

      for (const header of [
        'Bearer abc.def.ghi',
        'Bearer ',
        'Bearer',
        `Bearer ${hetHan}`,
        `Bearer ${saiChuKy}`,
        `Bearer ${algNone}`,
        `Bearer ${khongTonTai}`,
        `Basic ${Buffer.from('ad001:AD001@Nhom8').toString('base64')}`,
      ]) {
        await http.get('/auth/me').set('Authorization', header).expect(401);
      }
      await http.get('/auth/me').set(auth(admin)).expect(200);
    });
  });

  // ------------------------------------------------------------ DANH MỤC
  describe('CAT - danh mục', () => {
    const DANH_MUC = [
      {
        route: 'the-loai',
        tao: (ma: string) => ({ maTheLoai: ma, tenTheLoai: `TL ${ma}` }),
        tenCot: 'tenTheLoai',
        maCot: 'maTheLoai',
        maDai: { maTheLoai: 'M'.repeat(21), tenTheLoai: 'x' },
        tenDai: { maTheLoai: 'OK', tenTheLoai: 'T'.repeat(121) },
      },
      {
        route: 'nha-xuat-ban',
        tao: (ma: string) => ({ maNxb: ma, tenNxb: `NXB ${ma}` }),
        tenCot: 'tenNxb',
        maCot: 'maNxb',
        maDai: { maNxb: 'M'.repeat(21), tenNxb: 'x' },
        tenDai: { maNxb: 'OK', tenNxb: 'T'.repeat(300) },
      },
      {
        route: 'tac-gia',
        tao: (ma: string) => ({ maTacGia: ma, tenTacGia: `TG ${ma}` }),
        tenCot: 'tenTacGia',
        maCot: 'maTacGia',
        maDai: { maTacGia: 'M'.repeat(21), tenTacGia: 'x' },
        tenDai: { maTacGia: 'OK', tenTacGia: 'T'.repeat(300) },
      },
    ] as const;

    describe.each(DANH_MUC)('$route', (dm) => {
      it('CAT-01 list có phân trang, trang không trùng nhau, tham số sai -> 400', async () => {
        for (let i = 0; i < 3; i++) {
          await http
            .post(`/${dm.route}`)
            .set(auth(thuThu))
            .send(dm.tao(`P${i}${dm.route.slice(0, 2)}${sfx}`))
            .expect(201);
        }
        const p1 = await http
          .get(`/${dm.route}`)
          .query({ page: 1, limit: 2 })
          .set(auth(admin))
          .expect(200);
        const p2 = await http
          .get(`/${dm.route}`)
          .query({ page: 2, limit: 2 })
          .set(auth(admin))
          .expect(200);
        expect(p1.body).toMatchObject({ page: 1, limit: 2 });
        expect(p1.body.data).toHaveLength(2);
        expect(p1.body.total).toBeGreaterThanOrEqual(3);
        expect(p2.body.page).toBe(2);
        const ids1 = p1.body.data.map((r: Body) => r.id);
        const ids2 = p2.body.data.map((r: Body) => r.id);
        expect(ids2.length).toBeGreaterThan(0);
        expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);

        for (const query of [
          { page: 0 },
          { limit: 0 },
          { limit: 101 },
          { page: 'x' },
        ]) {
          await http
            .get(`/${dm.route}`)
            .query(query)
            .set(auth(admin))
            .expect(400);
        }
        // mọi người dùng đăng nhập đều đọc được danh mục
        const { id } = ids1.length ? { id: ids1[0] } : { id: '' };
        await http.get(`/${dm.route}/${id}`).set(auth(admin)).expect(200);
        await http
          .get(`/${dm.route}/${ID_KHONG_CO}`)
          .set(auth(admin))
          .expect(404);
        await http.get(`/${dm.route}`).expect(401);
      });

      it('CAT-07 body thiếu / rỗng / vượt độ dài -> 400, DB không đổi', async () => {
        const truoc = await dem(dm.route.replaceAll('-', '_'));
        for (const body of [
          {},
          { [dm.maCot]: '' },
          { [dm.maCot]: `X${sfx}` },
          dm.maDai,
          dm.tenDai,
        ]) {
          await http
            .post(`/${dm.route}`)
            .set(auth(admin))
            .send(body)
            .expect(400);
        }
        const ban = await http
          .post(`/${dm.route}`)
          .set(auth(admin))
          .send(dm.tao(`U${dm.route.slice(0, 2)}${sfx}`))
          .expect(201);
        await http
          .patch(`/${dm.route}/${ban.body.id}`)
          .set(auth(admin))
          .send({ [dm.tenCot]: '' })
          .expect(400);
        const sau = await http
          .get(`/${dm.route}/${ban.body.id}`)
          .set(auth(admin))
          .expect(200);
        expect(sau.body[dm.tenCot]).toBe(ban.body[dm.tenCot]);
        expect(await dem(dm.route.replaceAll('-', '_'))).toBe(truoc + 1);
      });
    });

    it('CAT-11 ADMIN xóa danh mục đang được sách dùng -> 409, dữ liệu còn nguyên', async () => {
      const tl = await taoDanhMuc('TL', '2');
      const nxb = await taoDanhMuc('NXB', '2');
      const tg = await taoDanhMuc('TG', '2');
      const sach = await http
        .post('/sach')
        .set(auth(admin))
        .send({
          maSach: `SC${sfx}`,
          tenSach: 'Sach CAT-11',
          maTheLoai: tl.ma,
          maNxb: nxb.ma,
          maTacGias: [tg.ma],
        })
        .expect(201);
      for (const [route, c] of [
        ['the-loai', tl],
        ['nha-xuat-ban', nxb],
        ['tac-gia', tg],
      ] as const) {
        await http.delete(`/${route}/${c.id}`).set(auth(admin)).expect(409);
        await http.get(`/${route}/${c.id}`).set(auth(admin)).expect(200);
      }
      const detail = await http
        .get(`/sach/${sach.body.id}`)
        .set(auth(admin))
        .expect(200);
      expect(detail.body.sachTacGias).toHaveLength(1);
      // gỡ sách khỏi danh mục rồi thì xóa được
      await http.delete(`/sach/${sach.body.id}`).set(auth(admin)).expect(200);
      for (const [route, c] of [
        ['the-loai', tl],
        ['nha-xuat-ban', nxb],
        ['tac-gia', tg],
      ] as const) {
        await http.delete(`/${route}/${c.id}`).set(auth(admin)).expect(200);
        await http.get(`/${route}/${c.id}`).set(auth(admin)).expect(404);
      }
    });
  });

  // ---------------------------------------------------------------- SÁCH
  describe('BOOK / COPY - sách và bản sách', () => {
    it('CAT-02 tìm sách tiếng Việt có dấu và không dấu', async () => {
      const ten = `Lập trình cơ sở dữ liệu ${sfx}`;
      const sach = await taoSach(`SV${sfx}`, 0, { tenSach: ten });
      for (const tuKhoa of [
        ten,
        ten.toLowerCase(),
        `lap trinh co so du lieu ${sfx}`,
      ]) {
        const res = await http
          .get('/sach')
          .query({ tuKhoa })
          .set(auth(admin))
          .expect(200);
        expect(res.body.data.map((r: Body) => r.ma_sach)).toContain(sach.ma);
      }
      const khongCo = await http
        .get('/sach')
        .query({ tuKhoa: `zzzkhongco${sfx}` })
        .set(auth(admin))
        .expect(200);
      expect(khongCo.body.data).toEqual([]);
    });

    it('BOOK-09 sửa metadata sách: detail trả dữ liệu mới, mã lạ -> 404, giá trị sai -> 400', async () => {
      const tl2 = await taoDanhMuc('TL', '3');
      const tg2 = await taoDanhMuc('TG', '3');
      const sach = await taoSach(`SU${sfx}`, 0);
      const res = await http
        .patch(`/sach/${sach.id}`)
        .set(auth(thuThu))
        .send({
          tenSach: 'Ten sach da sua',
          namXuatBan: 2024,
          giaBia: 123456.5,
          moTa: 'Mo ta moi',
          maTheLoai: tl2.ma,
          maTacGias: [tg1.ma, tg2.ma],
        })
        .expect(200);
      expect(res.body).toMatchObject({
        tenSach: 'Ten sach da sua',
        namXuatBan: 2024,
      });
      const detail = await http
        .get(`/sach/${sach.id}`)
        .set(auth(admin))
        .expect(200);
      expect(detail.body).toMatchObject({
        maSach: sach.ma,
        tenSach: 'Ten sach da sua',
        moTa: 'Mo ta moi',
        theLoai: { maTheLoai: tl2.ma },
      });
      expect(Number(detail.body.giaBia)).toBe(123456.5);
      expect(
        detail.body.sachTacGias.map((x: Body) => x.tacGia.maTacGia).sort(),
      ).toEqual([tg1.ma, tg2.ma].sort());

      await http
        .patch(`/sach/${sach.id}`)
        .set(auth(admin))
        .send({ maTheLoai: 'KHONG_CO' })
        .expect(404);
      await http
        .patch(`/sach/${sach.id}`)
        .set(auth(admin))
        .send({ maTacGias: ['KHONG_CO'] })
        .expect(404);
      await http
        .patch(`/sach/${ID_KHONG_CO}`)
        .set(auth(admin))
        .send({ tenSach: 'x' })
        .expect(404);
      for (const body of [
        { tenSach: '' },
        { giaBia: -1 },
        { namXuatBan: 10000 },
        { maTacGias: ['a', 'a'] },
      ]) {
        await http
          .patch(`/sach/${sach.id}`)
          .set(auth(admin))
          .send(body)
          .expect(400);
      }
      await http
        .patch(`/sach/${sach.id}`)
        .set(auth(readerOf()))
        .send({ tenSach: 'x' })
        .expect(403);
      const sau = await http
        .get(`/sach/${sach.id}`)
        .set(auth(admin))
        .expect(200);
      expect(sau.body.tenSach).toBe('Ten sach da sua');
    });

    it('BOOK-10 xóa sách chưa có bản: thành công, kèm liên kết tác giả', async () => {
      const sach = await taoSach(`SD${sfx}`, 0);
      await http.delete(`/sach/${sach.id}`).set(auth(admin)).expect(200);
      await http.get(`/sach/${sach.id}`).set(auth(admin)).expect(404);
      expect(await dem('sach_tac_gia', 'sach_id = ?', [sach.id])).toBe(0);
      await http.delete(`/sach/${sach.id}`).set(auth(admin)).expect(404);
    });

    it('BOOK-11 xóa sách có bản / có lịch sử: bị chặn (409), không mất dữ liệu', async () => {
      const sach = await taoSach(`SH${sfx}`, 2);
      await http.delete(`/sach/${sach.id}`).set(auth(admin)).expect(409);
      const detail = await http
        .get(`/sach/${sach.id}`)
        .set(auth(admin))
        .expect(200);
      expect(detail.body.sachTacGias).toHaveLength(1); // transaction hoàn tác, không mất liên kết tác giả
      const bans = await http
        .get(`/sach/${sach.id}/ban-sach`)
        .set(auth(admin))
        .expect(200);
      expect(bans.body).toHaveLength(2);

      // có lịch sử mượn trả thì cũng không xóa được
      const docGia = await taoBanDoc(`DH${sfx}`);
      await muon(docGia.ma, [sach.bans[0]]).expect(201);
      await tra(sach.bans[0]).expect(200);
      await http.delete(`/sach/${sach.id}`).set(auth(admin)).expect(409);
      expect(await dem('ban_sach', 'sach_id = ?', [sach.id])).toBe(2);
    });

    it('COPY-06 đổi tình trạng bản sách hợp lệ và ghi nhật ký; giá trị lạ -> 400', async () => {
      const ma = layBan();
      const ban = await http
        .get(`/ban-sach/${ma}`)
        .set(auth(admin))
        .expect(200);
      const truoc = await dem(
        'nhat_ky_hanh_vi',
        "loai_hanh_vi = 'DOI_TINH_TRANG' AND doi_tuong_id = ?",
        [ban.body.id],
      );
      const chuoi = [
        'HU_HONG',
        'SAN_SANG',
        'MAT',
        'SAN_SANG',
        'NGUNG_PHUC_VU',
        'SAN_SANG',
      ];
      for (const tinhTrang of chuoi) {
        const res = await http
          .patch(`/ban-sach/${ma}/tinh-trang`)
          .set(auth(thuThu))
          .send({ tinhTrang })
          .expect(200);
        expect(res.body.tinhTrang).toBe(tinhTrang);
        expect(await tinhTrangBan(ma)).toBe(tinhTrang);
      }
      expect(
        await dem(
          'nhat_ky_hanh_vi',
          "loai_hanh_vi = 'DOI_TINH_TRANG' AND doi_tuong_id = ?",
          [ban.body.id],
        ),
      ).toBe(truoc + chuoi.length);

      for (const tinhTrang of ['BAO_TRI', '', 'san_sang']) {
        await http
          .patch(`/ban-sach/${ma}/tinh-trang`)
          .set(auth(admin))
          .send({ tinhTrang })
          .expect(400);
      }
      // trạng thái có thật nhưng chỉ hệ thống mới được đặt (mượn/giữ) -> procedure từ chối
      for (const tinhTrang of ['DANG_MUON', 'DANG_GIU']) {
        await http
          .patch(`/ban-sach/${ma}/tinh-trang`)
          .set(auth(admin))
          .send({ tinhTrang })
          .expect(422);
      }
      await http
        .patch(`/ban-sach/KHONG-CO/tinh-trang`)
        .set(auth(admin))
        .send({ tinhTrang: 'MAT' })
        .expect(422);
      await http
        .patch(`/ban-sach/${ma}/tinh-trang`)
        .set(auth(readerOf()))
        .send({ tinhTrang: 'MAT' })
        .expect(403);
      expect(await tinhTrangBan(ma)).toBe('SAN_SANG');
      kho.push(ma);
    });

    it('COPY-07 bản đang mượn không đổi tình trạng được (422), trạng thái cũ giữ nguyên', async () => {
      const docGia = await taoBanDoc(`DC${sfx}`);
      const ma = layBan();
      await muon(docGia.ma, [ma]).expect(201);
      for (const tinhTrang of ['HU_HONG', 'MAT', 'SAN_SANG', 'NGUNG_PHUC_VU']) {
        const res = await http
          .patch(`/ban-sach/${ma}/tinh-trang`)
          .set(auth(admin))
          .send({ tinhTrang })
          .expect(422);
        expect(res.body.message).toMatch(/đang mượn/);
      }
      expect(await tinhTrangBan(ma)).toBe('DANG_MUON');
      await tra(ma).expect(200);
    });
  });

  // ----------------------------------------------------------- NGƯỜI DÙNG
  describe('USER / ACC - người dùng và tài khoản', () => {
    const dgBody = (ma: string, extra: Body = {}) => ({
      maNguoiDung: ma,
      hoTen: `Nguoi dung ${ma}`,
      loaiNguoiDung: 'SINH_VIEN',
      ...extra,
    });

    it('USER-01 list/filter/pagination/sort người dùng', async () => {
      for (const [ma, loai, extra] of [
        [`UA${sfx}`, 'GIANG_VIEN', {}],
        [`UB${sfx}`, 'SINH_VIEN', {}],
        [`UC${sfx}`, 'SINH_VIEN', {}],
      ] as const) {
        await http
          .post('/docgia')
          .set(auth(thuThu))
          .send(dgBody(ma, { loaiNguoiDung: loai, ...extra }))
          .expect(201);
      }
      await http
        .patch(`/docgia/${await timId(`UC${sfx}`)}/trang-thai`)
        .set(auth(thuThu))
        .send({ trangThai: 'TAM_KHOA' })
        .expect(200);

      const tatCa = await http
        .get('/docgia')
        .query({ tuKhoa: `U`, sapXep: 'maNguoiDung:asc', limit: 100 })
        .set(auth(admin))
        .expect(200);
      expect(tatCa.body.total).toBeGreaterThanOrEqual(3);
      const rieng = await http
        .get('/docgia')
        .query({ tuKhoa: sfx.toLowerCase() })
        .set(auth(admin))
        .expect(200);
      const maCuaToi = rieng.body.data.map((r: Body) => r.maNguoiDung);
      expect(maCuaToi).toEqual(
        expect.arrayContaining([`UA${sfx}`, `UB${sfx}`, `UC${sfx}`]),
      );

      const giangVien = await http
        .get('/docgia')
        .query({ tuKhoa: `UA${sfx}`, loaiNguoiDung: 'GIANG_VIEN' })
        .set(auth(admin))
        .expect(200);
      expect(giangVien.body.total).toBe(1);
      const sinhVienKhoa = await http
        .get('/docgia')
        .query({ tuKhoa: `UC${sfx}`, trangThai: 'TAM_KHOA' })
        .set(auth(admin))
        .expect(200);
      expect(sinhVienKhoa.body.total).toBe(1);
      const khongKhop = await http
        .get('/docgia')
        .query({ tuKhoa: `UA${sfx}`, loaiNguoiDung: 'SINH_VIEN' })
        .set(auth(admin))
        .expect(200);
      expect(khongKhop.body).toMatchObject({ total: 0, data: [] });

      const trang = await http
        .get('/docgia')
        .query({ tuKhoa: `U${'A'}${sfx}`, page: 1, limit: 1 })
        .set(auth(admin))
        .expect(200);
      expect(trang.body).toMatchObject({ page: 1, limit: 1 });
      const sapXep = await http
        .get('/docgia')
        .query({ tuKhoa: sfx, sapXep: 'maNguoiDung:desc', limit: 100 })
        .set(auth(admin))
        .expect(200);
      const ma = sapXep.body.data.map((r: Body) => r.maNguoiDung as string);
      expect(ma).toEqual([...ma].sort(soSanhChuoi).reverse());

      for (const query of [
        { loaiNguoiDung: 'ROBOT' },
        { trangThai: 'X' },
        { sapXep: 'matKhau:asc' },
        { sapXep: 'hoTen' },
        { limit: 101 },
        { page: 0 },
      ]) {
        await http.get('/docgia').query(query).set(auth(admin)).expect(400);
      }
      // tìm tên có dấu bằng không dấu
      const khongDau = await http
        .get('/docgia')
        .query({ tuKhoa: `nguyen van an ${sfx.toLowerCase()}` })
        .set(auth(admin))
        .expect(200);
      expect(khongDau.body.data.map((r: Body) => r.maNguoiDung)).toContain(
        docGiaChung.ma,
      );
    });

    const timId = async (ma: string) => {
      const res = await http
        .get('/docgia')
        .query({ tuKhoa: ma })
        .set(auth(admin))
        .expect(200);
      return res.body.data.find((r: Body) => r.maNguoiDung === ma).id as string;
    };

    it('USER-02 detail: 200 / 404 / 400, không lộ mật khẩu', async () => {
      const res = await http
        .get(`/docgia/${docGiaChung.id}`)
        .set(auth(thuThu))
        .expect(200);
      expect(res.body).toMatchObject({
        maNguoiDung: docGiaChung.ma,
        taiKhoan: { vaiTro: 'BAN_DOC', trangThai: 'HOAT_DONG' },
      });
      expect(JSON.stringify(res.body)).not.toMatch(
        /matKhauHash|mat_khau|muoi/i,
      );
      const chuaCoTk = await http
        .post('/docgia')
        .set(auth(admin))
        .send(dgBody(`UN${sfx}`))
        .expect(201);
      const detail = await http
        .get(`/docgia/${chuaCoTk.body.id}`)
        .set(auth(admin))
        .expect(200);
      expect(detail.body.taiKhoan).toBeNull();
      await http.get(`/docgia/${ID_KHONG_CO}`).set(auth(admin)).expect(404);
      await http.get('/docgia/abc').set(auth(admin)).expect(400);
      await http
        .get(`/docgia/${docGiaChung.id}`)
        .set(auth(docGiaChung.token))
        .expect(403);
    });

    it('USER-04 trùng mã/email hoặc body sai -> 409/400, DB không đổi', async () => {
      const email = `e${sfx.toLowerCase()}@uit.edu.vn`;
      await http
        .post('/docgia')
        .set(auth(admin))
        .send(dgBody(`UE${sfx}`, { email }))
        .expect(201);
      const truoc = await dem('nguoi_dung');
      await http
        .post('/docgia')
        .set(auth(admin))
        .send(dgBody(`UE${sfx}`))
        .expect(409);
      await http
        .post('/docgia')
        .set(auth(admin))
        .send(dgBody(`UF${sfx}`, { email }))
        .expect(409);
      for (const body of [
        {},
        dgBody(''),
        dgBody(`UG${sfx}`, { email: 'khong-phai-email' }),
        dgBody(`UG${sfx}`, { loaiNguoiDung: 'ROBOT' }),
        dgBody('M'.repeat(21)),
        { maNguoiDung: `UG${sfx}`, loaiNguoiDung: 'SINH_VIEN' },
        dgBody(`UG${sfx}`, { hoTen: 'H'.repeat(161) }),
        dgBody(`UG${sfx}`, { sdt: '1'.repeat(21) }),
      ]) {
        await http.post('/docgia').set(auth(admin)).send(body).expect(400);
      }
      expect(await dem('nguoi_dung')).toBe(truoc);
    });

    it('USER-05 sửa thông tin; field không cho phép (trạng thái, id) bị bỏ qua', async () => {
      const emailKhac = `khac${sfx.toLowerCase()}@uit.edu.vn`;
      await http
        .post('/docgia')
        .set(auth(admin))
        .send(dgBody(`UQ${sfx}`, { email: emailKhac }))
        .expect(201);
      const id = (
        await http
          .post('/docgia')
          .set(auth(admin))
          .send(dgBody(`UP${sfx}`))
          .expect(201)
      ).body.id as string;
      const res = await http
        .patch(`/docgia/${id}`)
        .set(auth(thuThu))
        .send({
          hoTen: 'Ho ten moi',
          email: `moi${sfx.toLowerCase()}@uit.edu.vn`,
          sdt: '0901234567',
          khoaDonVi: 'Khoa CNTT',
          trangThai: 'NGUNG',
          id: ID_KHONG_CO,
          createdAt: '2000-01-01',
          taiKhoan: { vaiTro: 'ADMIN' },
        })
        .expect(200);
      expect(res.body).toMatchObject({
        id,
        hoTen: 'Ho ten moi',
        sdt: '0901234567',
        khoaDonVi: 'Khoa CNTT',
        trangThai: 'HOAT_DONG',
      });
      await http
        .patch(`/docgia/${id}`)
        .set(auth(admin))
        .send({ email: 'sai-email' })
        .expect(400);
      await http
        .patch(`/docgia/${id}`)
        .set(auth(admin))
        .send({ hoTen: '' })
        .expect(400);
      await http
        .patch(`/docgia/${ID_KHONG_CO}`)
        .set(auth(admin))
        .send({ hoTen: 'x' })
        .expect(404);
      await http
        .patch(`/docgia/${id}`)
        .set(auth(admin))
        .send({ email: emailKhac, maNguoiDung: `UQ${sfx}` })
        .expect(409);
      // xóa email bằng chuỗi rỗng
      const xoa = await http
        .patch(`/docgia/${id}`)
        .set(auth(admin))
        .send({ email: '' })
        .expect(200);
      expect(xoa.body.email).toBeNull();
    });

    const taoCanBo = async (ma: string) =>
      (
        await http
          .post('/docgia')
          .set(auth(admin))
          .send(dgBody(ma, { loaiNguoiDung: 'CAN_BO' }))
          .expect(201)
      ).body as Body;
    const soLogTrangThai = (id: string) =>
      dem(
        'nhat_ky_hanh_vi',
        "loai_hanh_vi = 'DOI_TRANG_THAI_ND' AND doi_tuong_id = ?",
        [id],
      );

    it('USER-08 ADMIN đổi trạng thái CAN_BO; thủ thư không được', async () => {
      const cb = await taoCanBo(`UH${sfx}`);
      await http
        .patch(`/docgia/${cb.id}/trang-thai`)
        .set(auth(thuThu))
        .send({ trangThai: 'TAM_KHOA' })
        .expect(403);
      expect(
        (await http.get(`/docgia/${cb.id}`).set(auth(admin)).expect(200)).body
          .trangThai,
      ).toBe('HOAT_DONG');
      const res = await http
        .patch(`/docgia/${cb.id}/trang-thai`)
        .set(auth(admin))
        .send({ trangThai: 'TAM_KHOA' })
        .expect(200);
      expect(res.body.trangThai).toBe('TAM_KHOA');
      await http
        .patch(`/docgia/${cb.id}/trang-thai`)
        .set(auth(admin))
        .send({ trangThai: 'HOAT_DONG' })
        .expect(200);
      await http
        .patch(`/docgia/${cb.id}/trang-thai`)
        .set(auth(admin))
        .send({ trangThai: 'XYZ' })
        .expect(400);
    });

    // BUG đã biết: DocgiaService.doiTrangThai đổi cán bộ bằng UPDATE trực tiếp nên không ghi nhật ký DOI_TRANG_THAI_ND
    // (chỉ sp_doi_trang_thai_nguoi_dung cho bạn đọc mới ghi). Khi sửa xong, bỏ `.fails`.
    it.fails(
      'USER-08b đổi trạng thái CAN_BO phải để lại dòng nhật ký (audit)',
      async () => {
        const cb = await taoCanBo(`UL${sfx}`);
        const truoc = await soLogTrangThai(cb.id);
        await http
          .patch(`/docgia/${cb.id}/trang-thai`)
          .set(auth(admin))
          .send({ trangThai: 'TAM_KHOA' })
          .expect(200);
        expect(await soLogTrangThai(cb.id)).toBe(truoc + 1);
      },
    );

    it('USER-10 xóa mềm người dùng: chuyển NGUNG, khóa tài khoản, giữ lịch sử', async () => {
      const docGia = await taoBanDoc(`UX${sfx}`);
      const ma = layBan();
      await muon(docGia.ma, [ma]).expect(201);
      await tra(ma).expect(200);

      const res = await http
        .delete(`/docgia/${docGia.id}`)
        .set(auth(thuThu))
        .expect(200);
      expect(res.body).toMatchObject({
        trangThai: 'NGUNG',
        taiKhoan: { trangThai: 'KHOA' },
      });
      await http.get(`/docgia/${docGia.id}`).set(auth(admin)).expect(200);
      const lichSu = await http
        .get('/bao-cao/lich-su-muon')
        .query({ maNguoiDung: docGia.ma })
        .set(auth(admin))
        .expect(200);
      expect(lichSu.body.length).toBeGreaterThan(0);
      await http.get('/auth/me').set(auth(docGia.token)).expect(401);
      const dn = await http
        .post('/auth/login')
        .send({ tenDangNhap: docGia.ma.toLowerCase(), matKhau: PASSWORD })
        .expect(401);
      expect(dn.body.message).toMatch(/khóa/);
      await http.delete(`/docgia/${docGia.id}`).set(auth(thuThu)).expect(422); // đã NGUNG
      await http.delete(`/docgia/${ID_KHONG_CO}`).set(auth(thuThu)).expect(404);
      await http
        .delete(`/docgia/${docGia.id}`)
        .set(auth(docGiaChung.token))
        .expect(403);
    });

    it('ACC-03 tài khoản trùng / đã có / vai trò không khớp loại -> 409/422, mật khẩu ngắn -> 400', async () => {
      const bd = await http
        .post('/docgia')
        .set(auth(admin))
        .send(dgBody(`UI${sfx}`))
        .expect(201);
      const cb = await http
        .post('/docgia')
        .set(auth(admin))
        .send(dgBody(`UJ${sfx}`, { loaiNguoiDung: 'CAN_BO' }))
        .expect(201);
      const taiKhoan = (id: string, body: Body, token = admin) =>
        http.post(`/docgia/${id}/tai-khoan`).set(auth(token)).send(body);

      await taiKhoan(bd.body.id, { matKhau: PASSWORD, vaiTro: 'ADMIN' }).expect(
        422,
      );
      await taiKhoan(bd.body.id, {
        matKhau: PASSWORD,
        vaiTro: 'THU_THU',
      }).expect(422);
      await taiKhoan(cb.body.id, {
        matKhau: PASSWORD,
        vaiTro: 'BAN_DOC',
      }).expect(422);
      await taiKhoan(bd.body.id, { matKhau: 'ngan' }).expect(400);
      await taiKhoan(bd.body.id, { matKhau: PASSWORD, vaiTro: 'ROOT' }).expect(
        400,
      );
      expect(
        await dem('tai_khoan', 'nguoi_dung_id IN (?, ?)', [
          bd.body.id,
          cb.body.id,
        ]),
      ).toBe(0);

      await taiKhoan(bd.body.id, { matKhau: PASSWORD }).expect(201);
      await taiKhoan(bd.body.id, { matKhau: PASSWORD }).expect(409); // đã có tài khoản
      await taiKhoan(cb.body.id, {
        matKhau: PASSWORD,
        tenDangNhap: `uI${sfx}`.toLowerCase(),
      }).expect(409); // trùng tên đăng nhập
      const ok = await taiKhoan(cb.body.id, { matKhau: PASSWORD }).expect(201);
      expect(ok.body).toMatchObject({
        vaiTro: 'THU_THU',
        trangThai: 'HOAT_DONG',
      });
      await taiKhoan(ID_KHONG_CO, { matKhau: PASSWORD }).expect(404);
      await taiKhoan(bd.body.id, { matKhau: PASSWORD }, thuThu).expect(403);
    });

    it('SEC-02 mass assignment: field lạ bị loại ở docgia, sach, danh mục', async () => {
      const dg = await http
        .post('/docgia')
        .set(auth(admin))
        .send(
          dgBody(`UK${sfx}`, {
            trangThai: 'NGUNG',
            id: ID_KHONG_CO,
            createdAt: '2000-01-01',
            vaiTro: 'ADMIN',
          }),
        )
        .expect(201);
      expect(dg.body.trangThai).toBe('HOAT_DONG');
      expect(dg.body.id).not.toBe(ID_KHONG_CO);
      expect(dg.body.createdAt).not.toMatch(/^2000/);
      expect(dg.body.vaiTro).toBeUndefined();

      const sach = await taoSach(`SM${sfx}`, 0, {
        id: ID_KHONG_CO,
        daXoa: true,
      });
      expect(sach.id).not.toBe(ID_KHONG_CO);
      const tl = await http
        .post('/the-loai')
        .set(auth(admin))
        .send({ maTheLoai: `TM${sfx}`, tenTheLoai: 'x', id: ID_KHONG_CO })
        .expect(201);
      expect(tl.body.id).not.toBe(ID_KHONG_CO);
      const dn = await http
        .post('/auth/login')
        .send({
          tenDangNhap: ADMIN.tenDangNhap,
          matKhau: ADMIN.matKhau,
          vaiTro: 'BAN_DOC',
        })
        .expect(200);
      expect(dn.body.user.vaiTro).toBe('ADMIN');
    });
  });

  // ------------------------------------------------------- MƯỢN - TRẢ - PHẠT
  describe('LOAN / RETURN - phiếu mượn', () => {
    let a: { ma: string; id: string; token: string };
    let b: { ma: string; id: string; token: string };

    beforeAll(async () => {
      a = await taoBanDoc(`LA${sfx}`);
      b = await taoBanDoc(`LB${sfx}`);
    });

    it('LOAN-03 trùng bản trong cùng request -> 400, không tạo phiếu', async () => {
      const ma = layBan();
      const truoc = await dem('phieu_muon');
      await muon(a.ma, [ma, ma]).expect(400);
      await muon(a.ma, []).expect(400);
      await muon(a.ma, [ma, 'KHONG-CO']).expect(422);
      await muon('KHONG-CO', [ma]).expect(422);
      expect(await dem('phieu_muon')).toBe(truoc);
      expect(await tinhTrangBan(ma)).toBe('SAN_SANG');
      kho.push(ma);
    });

    it('LOAN-08 list phiếu: lọc trạng thái/người dùng, phân trang, sắp xếp, tham số sai -> 400', async () => {
      const [m1, m2] = [layBan(), layBan()];
      const p1 = (await muon(a.ma, [m1]).expect(201)).body;
      await muon(a.ma, [m2]).expect(201);
      await tra(m2).expect(200); // phiếu thứ hai HOAN_TAT

      const dang = await http
        .get('/phieu-muon')
        .query({ maNguoiDung: a.ma, trangThai: 'DANG_MUON' })
        .set(auth(admin))
        .expect(200);
      expect(dang.body.data.map((p: Body) => p.maPhieu)).toContain(p1.maPhieu);
      expect(
        dang.body.data.every(
          (p: Body) =>
            p.trangThai === 'DANG_MUON' && p.nguoiDung.maNguoiDung === a.ma,
        ),
      ).toBe(true);
      const xong = await http
        .get('/phieu-muon')
        .query({ maNguoiDung: a.ma, trangThai: 'HOAN_TAT' })
        .set(auth(admin))
        .expect(200);
      expect(
        xong.body.data.every((p: Body) => p.trangThai === 'HOAN_TAT'),
      ).toBe(true);
      expect(xong.body.total).toBe(1);

      const tong = await http
        .get('/phieu-muon')
        .query({ maNguoiDung: a.ma })
        .set(auth(admin))
        .expect(200);
      expect(tong.body.total).toBe(2);
      const trang = await http
        .get('/phieu-muon')
        .query({ maNguoiDung: a.ma, page: 2, limit: 1 })
        .set(auth(admin))
        .expect(200);
      expect(trang.body).toMatchObject({ page: 2, limit: 1, total: 2 });
      expect(trang.body.data).toHaveLength(1);
      const asc = await http
        .get('/phieu-muon')
        .query({ sapXep: 'maPhieu:asc', limit: 100 })
        .set(auth(admin))
        .expect(200);
      const maPhieu = asc.body.data.map((p: Body) => p.maPhieu as string);
      expect(maPhieu).toEqual([...maPhieu].sort(soSanhChuoi));
      const rong = await http
        .get('/phieu-muon')
        .query({ maNguoiDung: 'KHONG-CO' })
        .set(auth(admin))
        .expect(200);
      expect(rong.body).toMatchObject({ total: 0, data: [] });

      for (const query of [
        { trangThai: 'XYZ' },
        { sapXep: 'nguoiDung:asc' },
        { page: 0 },
        { limit: 101 },
      ]) {
        await http.get('/phieu-muon').query(query).set(auth(admin)).expect(400);
      }
      await http.get('/phieu-muon').set(auth(a.token)).expect(403);
      await tra(m1).expect(200);
    });

    it('LOAN-11 hủy phiếu rỗng vừa tạo: thành công, trạng thái HUY, có nhật ký', async () => {
      // API lập phiếu luôn kèm sách; phiếu rỗng chỉ có khi gọi thẳng sp_tao_phieu_muon
      const maPhieu = await db.procTransaction(async (tx) => {
        await tx.execute('CALL sp_tao_phieu_muon(?, ?, @ma_phieu)', [
          b.ma,
          'CB001',
        ]);
        const [{ ma_phieu }] = await tx.query<{ ma_phieu: string }>(
          'SELECT @ma_phieu AS ma_phieu',
        );
        return ma_phieu;
      });
      const phieu = await http
        .get(`/phieu-muon/${maPhieu}`)
        .set(auth(admin))
        .expect(200);
      expect(phieu.body.ctPhieuMuons).toHaveLength(0);

      await http
        .post(`/phieu-muon/${maPhieu}/huy`)
        .set(auth(b.token))
        .expect(403);
      const res = await http
        .post(`/phieu-muon/${maPhieu}/huy`)
        .set(auth(thuThu))
        .expect(200);
      expect(res.body).toMatchObject({ maPhieu, trangThai: 'HUY' });
      expect(
        await dem(
          'nhat_ky_hanh_vi',
          "loai_hanh_vi = 'HUY_PHIEU_MUON' AND doi_tuong_id = ?",
          [phieu.body.id],
        ),
      ).toBe(1);
      // hủy lần hai, phiếu không có thật
      await http
        .post(`/phieu-muon/${maPhieu}/huy`)
        .set(auth(thuThu))
        .expect(422);
      await http
        .post('/phieu-muon/PM-KHONG-CO/huy')
        .set(auth(thuThu))
        .expect(422);
    });

    it('LOAN-12 hủy phiếu đã có sách / đã hoàn tất -> 422, dữ liệu giữ nguyên', async () => {
      const ma = layBan();
      const phieu = (await muon(b.ma, [ma]).expect(201)).body;
      const res = await http
        .post(`/phieu-muon/${phieu.maPhieu}/huy`)
        .set(auth(thuThu))
        .expect(422);
      expect(res.body.message).toMatch(/đã có sách/);
      expect(
        (
          await http
            .get(`/phieu-muon/${phieu.maPhieu}`)
            .set(auth(admin))
            .expect(200)
        ).body.trangThai,
      ).toBe('DANG_MUON');
      expect(await tinhTrangBan(ma)).toBe('DANG_MUON');

      await tra(ma).expect(200);
      await http
        .post(`/phieu-muon/${phieu.maPhieu}/huy`)
        .set(auth(thuThu))
        .expect(422);
      const sau = await http
        .get(`/phieu-muon/${phieu.maPhieu}`)
        .set(auth(admin))
        .expect(200);
      expect(sau.body.trangThai).toBe('HOAN_TAT');
      expect(sau.body.ctPhieuMuons).toHaveLength(1);
    });

    it('RETURN-03 trả HU_HONG: phạt hư hỏng đúng mức, bản chuyển HU_HONG, chặn mượn đến khi nộp phạt', async () => {
      const ma = layBan();
      await muon(a.ma, [ma]).expect(201);
      const res = await tra(ma, 'HU_HONG').expect(200);
      expect(res.body.phieuPhats).toHaveLength(1);
      const phat = res.body.phieuPhats[0];
      const [{ muc }] = await db.query<{ muc: string }>(
        "SELECT fn_tham_so('PHAT_HU_HONG') AS muc",
      );
      expect(phat).toMatchObject({
        loaiPhat: 'HU_HONG',
        trangThai: 'CHUA_THANH_TOAN',
      });
      expect(Number(phat.soTien)).toBe(Number(muc));
      expect(await tinhTrangBan(ma)).toBe('HU_HONG');
      expect(res.body.tinhTrangTra).toBe('HU_HONG');

      // bản hỏng không cho mượn tiếp; người trả bị chặn đến khi nộp phạt
      const khac = layBan();
      await muon(b.ma, [ma]).expect(422);
      await muon(a.ma, [khac]).expect(422);
      await http
        .post(`/phat/${phat.id}/thanh-toan`)
        .set(auth(thuThu))
        .expect(200);
      await muon(a.ma, [khac]).expect(201);
      await tra(khac).expect(200);
      // sửa xong đưa bản về SAN_SANG
      await http
        .patch(`/ban-sach/${ma}/tinh-trang`)
        .set(auth(thuThu))
        .send({ tinhTrang: 'SAN_SANG' })
        .expect(200);
      expect(await tinhTrangBan(ma)).toBe('SAN_SANG');
      kho.push(ma, khac);
      // tình trạng trả không hợp lệ / bản không có lượt mượn mở
      await tra(ma, 'BAO_TRI').expect(400);
      await tra(ma).expect(422);
    });
  });

  // --------------------------------------------------- ĐẶT TRƯỚC (HÀNG CHỜ)
  describe('RES - đặt trước và hàng chờ', () => {
    type BanDoc = { ma: string; id: string; token: string };
    type KichBan = {
      a: BanDoc;
      b: BanDoc;
      c: BanDoc;
      d: BanDoc;
      sach: { ma: string; id: string; bans: string[] };
    };

    const luotDat = async (k: KichBan, token: string) =>
      (await http.get('/me/dat-truoc').set(auth(token)).expect(200)).body.find(
        (r: Body) => r.ma_sach === k.sach.ma,
      ) as Body;

    /** Mỗi test tự dựng kịch bản riêng: sách một bản đang bị `a` mượn (hết bản sẵn sàng), chưa ai đặt. */
    const dungKichBan = async (tag: string): Promise<KichBan> => {
      const [a, b, c, d] = [
        await taoBanDoc(`R${tag}A${sfx}`),
        await taoBanDoc(`R${tag}B${sfx}`),
        await taoBanDoc(`R${tag}C${sfx}`),
        await taoBanDoc(`R${tag}D${sfx}`),
      ];
      const sach = await taoSach(`SQ${tag}${sfx}`, 1);
      await muon(a.ma, sach.bans).expect(201);
      return { a, b, c, d, sach };
    };

    /** b đặt rồi c đặt (thủ thư đặt hộ b, c tự đặt). */
    const datHangCho = async (k: KichBan) => {
      await http
        .post('/dat-truoc')
        .set(auth(thuThu))
        .send({ maSach: k.sach.ma, maNguoiDung: k.b.ma })
        .expect(201);
      await http
        .post('/dat-truoc')
        .set(auth(k.c.token))
        .send({ maSach: k.sach.ma })
        .expect(201);
    };

    it('RES-04/05 thủ thư đặt hộ có maNguoiDung -> 201; thiếu maNguoiDung -> 400; bạn đọc không đặt hộ', async () => {
      const { b, c, sach } = await dungKichBan('1');
      await http
        .post('/dat-truoc')
        .set(auth(thuThu))
        .send({ maSach: sach.ma })
        .expect(400);
      await http
        .post('/dat-truoc')
        .set(auth(admin))
        .send({ maSach: sach.ma, maNguoiDung: '' })
        .expect(400);
      await http
        .post('/dat-truoc')
        .set(auth(thuThu))
        .send({ maSach: sach.ma, maNguoiDung: 'KHONG-CO' })
        .expect(422);
      await http
        .post('/dat-truoc')
        .set(auth(thuThu))
        .send({ maSach: 'KHONG-CO', maNguoiDung: b.ma })
        .expect(422);
      await http
        .post('/dat-truoc')
        .set(auth(c.token))
        .send({ maSach: sach.ma, maNguoiDung: b.ma })
        .expect(403);

      const ho = await http
        .post('/dat-truoc')
        .set(auth(thuThu))
        .send({ maSach: sach.ma, maNguoiDung: b.ma })
        .expect(201);
      expect(ho.body).toMatchObject({
        trangThai: 'CHO_XU_LY',
        nguoiDung: { maNguoiDung: b.ma },
        sach: { maSach: sach.ma },
      });
      // đặt lần hai khi đang chờ -> chặn (mỗi người một lượt hoạt động cho mỗi đầu sách)
      await http
        .post('/dat-truoc')
        .set(auth(b.token))
        .send({ maSach: sach.ma })
        .expect(422);
      expect(
        (
          await http
            .get('/dat-truoc')
            .query({ maNguoiDung: b.ma })
            .set(auth(admin))
            .expect(200)
        ).body.total,
      ).toBe(1);
      await http
        .post('/dat-truoc')
        .set(auth(c.token))
        .send({ maSach: sach.ma })
        .expect(201);
    });

    it('RES-08 bạn đọc luôn chỉ thấy đặt trước của mình dù gửi filter giả mạo', async () => {
      const k = await dungKichBan('2');
      await datHangCho(k);
      const { b, c, d, sach } = k;
      const res = await http
        .get('/dat-truoc')
        .query({ maNguoiDung: c.ma })
        .set(auth(b.token))
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(
        res.body.data.every((r: Body) => r.nguoiDung.maNguoiDung === b.ma),
      ).toBe(true);
      const rong = await http
        .get('/dat-truoc')
        .query({ maNguoiDung: b.ma })
        .set(auth(d.token))
        .expect(200);
      expect(rong.body).toMatchObject({ total: 0, data: [] });
      const staff = await http
        .get('/dat-truoc')
        .query({ maNguoiDung: c.ma, trangThai: 'CHO_XU_LY' })
        .set(auth(thuThu))
        .expect(200);
      expect(staff.body.data.map((r: Body) => r.nguoiDung.maNguoiDung)).toEqual(
        [c.ma],
      );
      await http
        .delete(`/dat-truoc/${sach.ma}`)
        .query({ maNguoiDung: b.ma })
        .set(auth(c.token))
        .expect(403);
      await http
        .get('/dat-truoc')
        .query({ trangThai: 'XYZ' })
        .set(auth(b.token))
        .expect(400);
    });

    it('hàng chờ FIFO: bản trả về được giữ cho người đặt sớm nhất; COPY-07/LOAN-07 bản đang giữ', async () => {
      const k = await dungKichBan('3');
      await datHangCho(k);
      const { b, c, d, sach } = k;
      const ma = sach.bans[0];
      expect((await luotDat(k, b.token)).thu_tu_cho).toBe(1);
      expect((await luotDat(k, c.token)).thu_tu_cho).toBe(2);

      await tra(ma).expect(200);
      expect(await tinhTrangBan(ma)).toBe('DANG_GIU');
      expect((await luotDat(k, b.token)).trang_thai).toBe('SAN_SANG_NHAN');
      expect((await luotDat(k, c.token)).trang_thai).toBe('CHO_XU_LY');

      // COPY-07: bản đang giữ không đổi tình trạng được
      await http
        .patch(`/ban-sach/${ma}/tinh-trang`)
        .set(auth(admin))
        .send({ tinhTrang: 'HU_HONG' })
        .expect(422);
      expect(await tinhTrangBan(ma)).toBe('DANG_GIU');
      // LOAN-07: người khác không mượn được bản đang giữ; thông báo không lộ người giữ
      const tuChoi = await muon(d.ma, [ma]).expect(422);
      expect(JSON.stringify(tuChoi.body)).not.toContain(b.ma);
      await muon(c.ma, [ma]).expect(422);
      expect(await tinhTrangBan(ma)).toBe('DANG_GIU');
      // đặt trước khi sách chưa có bản sẵn sàng nhưng đang giữ: người thứ ba vẫn xếp hàng được
      await http
        .post('/dat-truoc')
        .set(auth(d.token))
        .send({ maSach: sach.ma })
        .expect(201);

      // người được giữ mượn đúng bản đó -> lượt đặt DA_NHAN
      const phieu = (await muon(b.ma, [ma]).expect(201)).body;
      expect(phieu.ctPhieuMuons).toHaveLength(1);
      expect((await luotDat(k, b.token)).trang_thai).toBe('DA_NHAN');
      expect(await tinhTrangBan(ma)).toBe('DANG_MUON');

      // người kế tiếp được giữ khi bản trả về; bạn đọc sau cùng thứ tự 1
      await tra(ma).expect(200);
      expect((await luotDat(k, c.token)).trang_thai).toBe('SAN_SANG_NHAN');
      expect((await luotDat(k, d.token)).thu_tu_cho).toBe(1);
      await http.delete(`/dat-truoc/${sach.ma}`).set(auth(c.token)).expect(200);
      expect((await luotDat(k, d.token)).trang_thai).toBe('SAN_SANG_NHAN'); // bản nhả ra được giao cho người sau
      expect(await tinhTrangBan(ma)).toBe('DANG_GIU');
      await http.delete(`/dat-truoc/${sach.ma}`).set(auth(d.token)).expect(200);
      expect(await tinhTrangBan(ma)).toBe('SAN_SANG');
      await http.delete(`/dat-truoc/${sach.ma}`).set(auth(d.token)).expect(422); // không còn lượt hoạt động
    });
  });

  // ---------------------------------------------------------------- PHẠT
  describe('FINE - phiếu phạt', () => {
    let p: { ma: string; id: string; token: string };
    let q: { ma: string; id: string; token: string };
    const phat: Record<string, Body> = {};

    /** Mượn rồi trả với tình trạng cho trước; trả về phiếu phạt đầu tiên. */
    const phatMoi = async (ma: string, tinhTrang: 'HU_HONG' | 'MAT') => {
      const ban = layBan();
      await muon(ma, [ban]).expect(201);
      const res = await tra(ban, tinhTrang).expect(200);
      return res.body.phieuPhats[0] as Body;
    };

    beforeAll(async () => {
      [p, q] = [await taoBanDoc(`FP${sfx}`), await taoBanDoc(`FQ${sfx}`)];
      phat.huHong = await phatMoi(p.ma, 'HU_HONG');
      // p bị chặn mượn khi còn nợ: nộp xong mới tạo phiếu phạt thứ hai
      await http
        .post(`/phat/${phat.huHong.id}/thanh-toan`)
        .set(auth(thuThu))
        .expect(200);
      phat.matSach = await phatMoi(p.ma, 'MAT');
      phat.cua_q = await phatMoi(q.ma, 'MAT');
    });

    it('FINE-01 list phiếu phạt: lọc theo người/trạng thái, phân trang, sắp xếp, tham số sai -> 400', async () => {
      const cuaP = await http
        .get('/phat')
        .query({ maNguoiDung: p.ma })
        .set(auth(thuThu))
        .expect(200);
      expect(cuaP.body.total).toBe(2);
      expect(
        cuaP.body.data.map(
          (r: Body) => r.ctPhieuMuon.phieuMuon.nguoiDung.maNguoiDung,
        ),
      ).toEqual([p.ma, p.ma]);
      const chuaNop = await http
        .get('/phat')
        .query({ maNguoiDung: p.ma, trangThai: 'CHUA_THANH_TOAN' })
        .set(auth(thuThu))
        .expect(200);
      expect(chuaNop.body.data.map((r: Body) => r.id)).toEqual([
        phat.matSach.id,
      ]);
      const daNop = await http
        .get('/phat')
        .query({ maNguoiDung: p.ma, trangThai: 'DA_THANH_TOAN' })
        .set(auth(thuThu))
        .expect(200);
      expect(daNop.body.data.map((r: Body) => r.id)).toEqual([phat.huHong.id]);
      const trang = await http
        .get('/phat')
        .query({ maNguoiDung: p.ma, page: 2, limit: 1 })
        .set(auth(thuThu))
        .expect(200);
      expect(trang.body).toMatchObject({ page: 2, limit: 1, total: 2 });
      expect(trang.body.data).toHaveLength(1);
      const sapXep = await http
        .get('/phat')
        .query({ maNguoiDung: p.ma, sapXep: 'soTien:desc' })
        .set(auth(thuThu))
        .expect(200);
      const tien = sapXep.body.data.map((r: Body) => Number(r.soTien));
      expect(tien).toEqual([...tien].sort((x, y) => y - x));
      const tatCa = await http.get('/phat').set(auth(thuThu)).expect(200);
      expect(tatCa.body.total).toBeGreaterThanOrEqual(3);
      expect(tatCa.body.data.length).toBeLessThanOrEqual(tatCa.body.limit);
      for (const query of [
        { trangThai: 'XYZ' },
        { sapXep: 'lyDo:asc' },
        { limit: 101 },
        { page: 0 },
      ]) {
        await http.get('/phat').query(query).set(auth(thuThu)).expect(400);
      }
      await http.get('/phat').set(auth(p.token)).expect(403);
    });

    it('FINE-04 thanh toán lại / phiếu đã hủy / id không có -> lỗi, DB không đổi', async () => {
      const truoc = await dem('phieu_phat', "trang_thai = 'DA_THANH_TOAN'");
      const lai = await http
        .post(`/phat/${phat.huHong.id}/thanh-toan`)
        .set(auth(thuThu))
        .expect(422);
      expect(lai.body.message).toMatch(/chưa thanh toán/);
      await http
        .post(`/phat/${ID_KHONG_CO}/thanh-toan`)
        .set(auth(thuThu))
        .expect(422);
      await http.post('/phat/abc/thanh-toan').set(auth(thuThu)).expect(400);
      await http
        .post(`/phat/${phat.cua_q.id}/thanh-toan`)
        .set(auth(p.token))
        .expect(403);
      expect(await dem('phieu_phat', "trang_thai = 'DA_THANH_TOAN'")).toBe(
        truoc,
      );
      expect(
        await dem(
          'nhat_ky_hanh_vi',
          "loai_hanh_vi = 'THANH_TOAN_PHAT' AND doi_tuong_id = ?",
          [phat.huHong.id],
        ),
      ).toBe(1);
    });

    it('FINE-06 hủy thiếu lý do / lý do rỗng / không còn mở -> 400/422; thủ thư không được hủy', async () => {
      const id = phat.matSach.id;
      await http.post(`/phat/${id}/huy`).set(auth(admin)).send({}).expect(400);
      await http
        .post(`/phat/${id}/huy`)
        .set(auth(admin))
        .send({ lyDo: '' })
        .expect(400);
      await http
        .post(`/phat/${id}/huy`)
        .set(auth(admin))
        .send({ lyDo: 'L'.repeat(201) })
        .expect(400);
      await http
        .post(`/phat/${id}/huy`)
        .set(auth(admin))
        .send({ lyDo: '   ' })
        .expect(422);
      await http
        .post(`/phat/${id}/huy`)
        .set(auth(thuThu))
        .send({ lyDo: 'Lap nham' })
        .expect(403);
      await http
        .post(`/phat/${phat.huHong.id}/huy`)
        .set(auth(admin))
        .send({ lyDo: 'Da nop roi' })
        .expect(422); // đã thanh toán
      await http
        .post(`/phat/${ID_KHONG_CO}/huy`)
        .set(auth(admin))
        .send({ lyDo: 'x' })
        .expect(422);
      const con = await http
        .get('/phat')
        .query({ maNguoiDung: p.ma, trangThai: 'CHUA_THANH_TOAN' })
        .set(auth(admin))
        .expect(200);
      expect(con.body.total).toBe(1); // phiếu mất sách vẫn còn nguyên
      expect(
        await dem(
          'nhat_ky_hanh_vi',
          "loai_hanh_vi = 'HUY_PHAT' AND doi_tuong_id = ?",
          [id],
        ),
      ).toBe(0);
    });

    it('FINE-05 ADMIN hủy với lý do hợp lệ: HUY, lưu lý do, có nhật ký, mở lại quyền mượn', async () => {
      const id = phat.matSach.id;
      const ban = layBan();
      await muon(p.ma, [ban]).expect(422); // đang nợ phạt
      const res = await http
        .post(`/phat/${id}/huy`)
        .set(auth(admin))
        .send({ lyDo: 'Lap nham, ban doc da dem tra lai' })
        .expect(200);
      expect(res.body.trangThai).toBe('HUY');
      expect(res.body.lyDo).toContain('Lap nham, ban doc da dem tra lai');
      expect(
        await dem(
          'nhat_ky_hanh_vi',
          "loai_hanh_vi = 'HUY_PHAT' AND doi_tuong_id = ?",
          [id],
        ),
      ).toBe(1);
      await muon(p.ma, [ban]).expect(201);
      await tra(ban).expect(200);
      // phiếu đã hủy không thanh toán/hủy lại được
      await http.post(`/phat/${id}/thanh-toan`).set(auth(thuThu)).expect(422);
      await http
        .post(`/phat/${id}/huy`)
        .set(auth(admin))
        .send({ lyDo: 'Lan hai' })
        .expect(422);
      // phiếu của q vẫn còn nợ
      await muon(q.ma, [layBan()]).expect(422);
    });
  });

  // ------------------------------------------------------ BẠN ĐỌC / BÁO CÁO
  describe('ME / REPORT', () => {
    it('ME-06 bạn đọc chưa có dữ liệu: 200 với mảng rỗng', async () => {
      const moi = await taoBanDoc(`MR${sfx}`);
      for (const path of [
        'sach-dang-muon',
        'tien-phat',
        'lich-su-muon',
        'dat-truoc',
      ]) {
        const res = await http
          .get(`/me/${path}`)
          .set(auth(moi.token))
          .expect(200);
        expect(res.body).toEqual([]);
      }
      await http.get('/me/tien-phat').expect(401);
    });

    it('REPORT-05 giới hạn dòng và thứ tự của báo cáo top sách; enum/limit sai -> 400', async () => {
      const top = await http
        .get('/bao-cao/top-sach-muon-nhieu')
        .query({ limit: 3 })
        .set(auth(thuThu))
        .expect(200);
      expect(top.body.length).toBeLessThanOrEqual(3);
      const luot = top.body.map((r: Body) => Number(r.so_luot_muon));
      expect(luot).toEqual([...luot].sort((x, y) => y - x));
      const mot = await http
        .get('/bao-cao/top-sach-muon-nhieu')
        .query({ limit: 1 })
        .set(auth(thuThu))
        .expect(200);
      expect(mot.body).toHaveLength(1);
      expect(mot.body[0].ma_sach).toBe(top.body[0].ma_sach);
      const macDinh = await http
        .get('/bao-cao/top-sach-muon-nhieu')
        .set(auth(thuThu))
        .expect(200);
      expect(macDinh.body.length).toBeLessThanOrEqual(10);

      for (const limit of [0, 101, -1, 'abc', 1.5]) {
        await http
          .get('/bao-cao/top-sach-muon-nhieu')
          .query({ limit })
          .set(auth(thuThu))
          .expect(400);
      }
      await http
        .get('/bao-cao/dat-truoc')
        .query({ trangThai: 'XYZ' })
        .set(auth(thuThu))
        .expect(400);
      const khongCo = await http
        .get('/bao-cao/lich-su-muon')
        .query({ maNguoiDung: 'KHONG-CO' })
        .set(auth(thuThu))
        .expect(200);
      expect(khongCo.body).toEqual([]);
    });
  });

  // ---------------------------------------------------------------- DEMO
  describe('DEMO', () => {
    type Chay = Body;
    type Ngu = {
      /** bảng sau khi chạy theo nhãn bắt đầu bằng `nhan` */
      sau: (nhan: string) => Body[];
      /** bảng trước khi chạy (bước 3) theo nhãn bắt đầu bằng `nhan` */
      truoc: (nhan: string) => Body[];
      ketQua: Body[];
      chay: Chay;
    };
    type KyVong = {
      /** nhãn tình huống trong catalog (để phát hiện catalog đổi mà test không đổi theo) */
      nhan: RegExp;
      thanhCong: boolean;
      /** nội dung lỗi nghiệp vụ mong đợi khi thanhCong = false */
      loi?: string;
      kiemTra?: (n: Ngu) => void | Promise<void>;
    };

    const ngayCong = (iso: string, soNgay: number) =>
      new Date(Date.parse(`${iso}T00:00:00Z`) + soNgay * 86_400_000)
        .toISOString()
        .slice(0, 10);

    /** Mã bản sách riêng cho lần chạy này: mã mặc định BS900 có thể đã bị bản sách thật chiếm trên DB dùng chung. */
    const maBanSachDemo = `DM${sfx}`;
    /**
     * Người chờ S004 trong seed phụ thuộc ngày seed (nay đã quá hạn/khóa nên không còn đủ điều kiện nhận bản),
     * nên tình huống "có người chờ" chạy trên đầu sách có người chờ hợp lệ do test dựng.
     */
    let sachCoNguoiCho: { ma: string; id: string; bans: string[] };
    let nguoiCho: { ma: string; id: string; token: string };
    const ghiDeThamSo = (mucId: string, i: number): Record<string, string> =>
      mucId === 'trg-ban-sach-bi'
        ? {
            ma_ban_sach: maBanSachDemo,
            ...(i === 0 && { ma_sach: sachCoNguoiCho.ma }),
          }
        : {};

    let homNay: string;
    let tenBangCoSan: string[];

    /** Giá trị thật của tham số nghiệp vụ, đọc thẳng từ CSDL. */
    const thamSoNghiepVu = async (ma: string) =>
      Number(
        (
          await db.queryOne<{ gia_tri: string }>(
            'SELECT gia_tri FROM tham_so WHERE ma_tham_so = ?',
            [ma],
          )
        )?.gia_tri,
      );

    /** Checksum nội dung mọi bảng: bắt được cả UPDATE đổi giá trị mà không đổi số dòng. */
    const checksumTatCa = async (): Promise<Record<string, string>> => {
      const rows = await db.query<Body>(
        `CHECKSUM TABLE ${tenBangCoSan.join(', ')}`,
      );
      return Object.fromEntries(
        rows.map((r) => [String(r.Table).split('.').pop(), String(r.Checksum)]),
      );
    };

    const KY_VONG: Record<string, KyVong[]> = {
      'sp-tra-cuu-sach': [
        {
          nhan: /dữ liệu/,
          thanhCong: true,
          kiemTra: ({ ketQua, sau }) => {
            expect(ketQua.map((r) => r.ma_sach)).toContain('S003');
            expect(sau('nhat_ky_hanh_vi')[0]).toMatchObject({
              ma_nguoi_dung: 'SV001',
              loai_hanh_vi: 'TRA_CUU',
            });
            expect(sau('nhat_ky_hanh_vi')[0].mo_ta).toContain('dữ liệu');
          },
        },
        {
          nhan: /không ghi nhật ký/,
          thanhCong: true,
          kiemTra: ({ ketQua, sau }) => {
            expect(ketQua.map((r) => r.ma_sach)).toEqual(['S004']);
            expect(sau('nhat_ky_hanh_vi')[0]).toMatchObject({
              ma_nguoi_dung: null,
              loai_hanh_vi: 'TRA_CUU',
            });
          },
        },
        {
          nhan: /rỗng/,
          thanhCong: true,
          kiemTra: ({ ketQua, sau, truoc }) => {
            expect(ketQua).toEqual([]);
            expect(sau('nhat_ky_hanh_vi')).toEqual(truoc('nhat_ky_hanh_vi'));
          },
        },
      ],
      'sp-tra-sach': [
        {
          nhan: /BS006/,
          thanhCong: true,
          kiemTra: ({ sau, truoc }) => {
            const ct = sau('ct_phieu_muon')[0];
            expect(ct).toMatchObject({ tinh_trang_tra: 'BINH_THUONG' });
            expect(ct.ngay_tra).toBe(homNay);
            expect(sau('ban_sach')[0].tinh_trang).toBe('SAN_SANG');
            const phat = sau('phieu_phat');
            expect(phat).toHaveLength(truoc('phieu_phat').length + 1);
            const moi = phat[phat.length - 1];
            const ngayQuaHan = Math.round(
              (Date.parse(homNay) - Date.parse(String(ct.han_tra))) /
                86_400_000,
            );
            expect(moi).toMatchObject({
              loai_phat: 'QUA_HAN',
              trang_thai: 'CHUA_THANH_TOAN',
            });
            expect(Number(moi.so_tien)).toBeGreaterThan(0);
            expect(ngayQuaHan).toBeGreaterThan(0);
          },
        },
        {
          nhan: /BS008/,
          thanhCong: true,
          kiemTra: ({ sau }) => {
            expect(sau('ct_phieu_muon')[0].tinh_trang_tra).toBe('HU_HONG');
            expect(sau('ban_sach')[0].tinh_trang).toBe('HU_HONG');
            const phat = sau('phieu_phat');
            expect(phat[phat.length - 1]).toMatchObject({
              loai_phat: 'HU_HONG',
              so_tien: 50000,
              trang_thai: 'CHUA_THANH_TOAN',
            });
          },
        },
        {
          nhan: /không có lượt mượn mở/,
          thanhCong: false,
          loi: 'Bản sách không có lượt mượn đang mở',
        },
      ],
      'sp-gia-han': [
        {
          nhan: /7 ngày hợp lệ/,
          thanhCong: true,
          kiemTra: ({ sau, truoc }) => {
            const t = truoc('ct_phieu_muon')[0];
            const s = sau('ct_phieu_muon')[0];
            expect(s.han_tra).toBe(ngayCong(String(t.han_tra), 7));
            expect(s.so_lan_gia_han).toBe(Number(t.so_lan_gia_han) + 1);
          },
        },
        {
          nhan: /quá số ngày tối đa/,
          thanhCong: false,
          loi: 'Số ngày gia hạn không hợp lệ',
        },
        {
          nhan: /đã quá hạn/,
          thanhCong: false,
          loi: 'Sách đã quá hạn, không thể gia hạn',
        },
      ],
      'sp-dat-truoc': [
        {
          nhan: /S004 \(hết bản/,
          thanhCong: true,
          kiemTra: ({ sau, truoc }) => {
            const dat = sau('dat_truoc');
            expect(dat).toHaveLength(truoc('dat_truoc').length + 1);
            expect(dat[dat.length - 1]).toMatchObject({
              ma_nguoi_dung: 'SV008',
              ma_sach: 'S004',
              trang_thai: 'CHO_XU_LY',
            });
            expect(sau('nhat_ky_hanh_vi')[0]).toMatchObject({
              ma_nguoi_dung: 'SV008',
              loai_hanh_vi: 'DAT_TRUOC',
            });
          },
        },
        {
          nhan: /còn bản sẵn sàng/,
          thanhCong: false,
          loi: 'Sách còn bản sẵn sàng, không cần đặt trước',
        },
        {
          nhan: /nợ phạt/,
          thanhCong: false,
          loi: 'Còn nợ tiền phạt chưa thanh toán',
        },
      ],
      'sp-thanh-toan-phat': [
        {
          nhan: /chưa trả/,
          thanhCong: true,
          kiemTra: ({ sau, truoc }) => {
            expect(truoc('phieu_phat')[0].trang_thai).toBe('CHUA_THANH_TOAN');
            expect(sau('phieu_phat')[0]).toMatchObject({
              trang_thai: 'DA_THANH_TOAN',
              ngay_thanh_toan: homNay,
            });
            expect(sau('nhat_ky_hanh_vi')[0].loai_hanh_vi).toBe(
              'THANH_TOAN_PHAT',
            );
          },
        },
        {
          nhan: /đã thanh toán/,
          thanhCong: false,
          loi: 'Phiếu phạt không tồn tại hoặc không ở trạng thái chưa thanh toán',
        },
      ],
      'trg-phieu-muon-bi': [
        {
          nhan: /Sinh viên lập phiếu/,
          thanhCong: false,
          loi: 'Nhân viên lập phiếu phải là cán bộ thư viện',
        },
        {
          nhan: /Cán bộ lập phiếu/,
          thanhCong: true,
          kiemTra: ({ chay, sau, truoc }) => {
            expect(chay.soDongAnhHuong).toBe(1);
            const moi = sau('phieu_muon')[0];
            expect(moi).toMatchObject({
              nguoi_muon: 'SV001',
              nguoi_lap: 'CB001',
              trang_thai: 'DANG_MUON',
            });
            expect(moi.id).not.toBe(truoc('phieu_muon')[0].id);
          },
        },
      ],
      'trg-ctpm-bu': [
        {
          nhan: /hợp lệ/,
          thanhCong: true,
          kiemTra: ({ chay, sau }) => {
            expect(chay.soDongAnhHuong).toBe(1);
            expect(sau('ct_phieu_muon')[0]).toMatchObject({
              han_tra: '2026-10-20',
              so_lan_gia_han: 1,
            });
          },
        },
        {
          nhan: /quá 7 ngày/,
          thanhCong: false,
          loi: 'Số ngày gia hạn vượt quy định',
        },
        {
          nhan: /đã trả/,
          thanhCong: false,
          loi: 'Chi tiết mượn đã trả, không được sửa',
        },
      ],
      'trg-phieu-phat-bu': [
        {
          nhan: /chưa trả/,
          thanhCong: true,
          kiemTra: ({ chay, sau }) => {
            expect(chay.soDongAnhHuong).toBe(1);
            expect(sau('phieu_phat')[0]).toMatchObject({
              trang_thai: 'DA_THANH_TOAN',
              ngay_thanh_toan: homNay,
            });
          },
        },
        {
          nhan: /đã thanh toán/,
          thanhCong: false,
          loi: 'Phiếu phạt đã thanh toán hoặc đã hủy, không được sửa',
        },
      ],
      'trg-ban-sach-bi': [
        {
          nhan: /có người chờ/,
          thanhCong: true,
          kiemTra: ({ chay, sau }) => {
            expect(chay.soDongAnhHuong).toBe(1);
            const moi = sau('ban_sach').find(
              (r) => r.ma_ban_sach === maBanSachDemo,
            );
            expect(moi).toMatchObject({ ma_sach: sachCoNguoiCho.ma });
            // đầu sách có người chờ: bản mới được giữ cho người đặt sớm nhất
            expect(moi?.tinh_trang).toBe('DANG_GIU');
            const dat = sau('dat_truoc').find(
              (r) => r.ma_ban_sach === maBanSachDemo,
            );
            expect(dat).toMatchObject({
              ma_nguoi_dung: nguoiCho.ma,
              trang_thai: 'SAN_SANG_NHAN',
            });
          },
        },
        {
          nhan: /không ai chờ/,
          thanhCong: true,
          kiemTra: ({ chay, sau }) => {
            expect(chay.soDongAnhHuong).toBe(1);
            expect(
              sau('ban_sach').find((r) => r.ma_ban_sach === maBanSachDemo),
            ).toMatchObject({ ma_sach: 'S003', tinh_trang: 'SAN_SANG' });
            expect(sau('dat_truoc')).toEqual([]);
          },
        },
        {
          nhan: /DANG_MUON/,
          thanhCong: false,
          loi: 'Bản sách mới không được nhập ở trạng thái đang mượn hoặc đang giữ',
        },
      ],
      'trg-nguoi-dung-au': [
        {
          nhan: /Tạm khóa SV003/,
          thanhCong: true,
          kiemTra: ({ sau }) =>
            expect(sau('nguoi_dung')[0]).toMatchObject({
              trang_thai_nguoi_dung: 'TAM_KHOA',
              trang_thai_tai_khoan: 'KHOA',
            }),
        },
        {
          nhan: /Mở lại SV007/,
          thanhCong: true,
          kiemTra: ({ sau }) =>
            expect(sau('nguoi_dung')[0]).toMatchObject({
              trang_thai_nguoi_dung: 'HOAT_DONG',
              trang_thai_tai_khoan: 'KHOA',
            }),
        },
      ],
      'fn-tien-phat-qua-han': [
        {
          nhan: /11 ngày/,
          thanhCong: true,
          kiemTra: ({ ketQua }) =>
            expect(ketQua).toEqual([{ so_ngay_qua_han: 11, tien_phat: 55000 }]),
        },
        {
          nhan: /mức trần/,
          thanhCong: true,
          kiemTra: ({ ketQua }) => {
            expect(ketQua).toHaveLength(1);
            expect(ketQua[0].so_ngay_qua_han).toBe(
              Math.round(
                (Date.parse('2026-10-07') - Date.parse('2026-01-01')) /
                  86_400_000,
              ),
            );
            expect(ketQua[0].tien_phat).toBe(100000);
          },
        },
        {
          nhan: /đúng hạn/,
          thanhCong: true,
          kiemTra: ({ ketQua }) =>
            expect(ketQua).toEqual([{ so_ngay_qua_han: 0, tien_phat: 0 }]),
        },
      ],
      'fn-ly-do-khong-the-muon': [
        {
          nhan: /SV001/,
          thanhCong: true,
          kiemTra: ({ ketQua }) =>
            expect(ketQua).toEqual([
              { ly_do: 'Đang giữ sách quá hạn chưa trả', co_the_muon: 0 },
            ]),
        },
        {
          nhan: /SV007/,
          thanhCong: true,
          kiemTra: ({ ketQua }) =>
            expect(ketQua).toEqual([
              { ly_do: 'Người dùng không hoạt động', co_the_muon: 0 },
            ]),
        },
        {
          nhan: /SV008/,
          thanhCong: true,
          kiemTra: ({ ketQua }) =>
            expect(ketQua).toEqual([{ ly_do: null, co_the_muon: 1 }]),
        },
      ],
      'fn-tham-so': [
        {
          nhan: /Thời hạn mượn/,
          thanhCong: true,
          kiemTra: async ({ ketQua }) =>
            expect(ketQua).toEqual([
              { gia_tri: await thamSoNghiepVu('SO_NGAY_MUON') },
            ]),
        },
        {
          nhan: /không tồn tại/,
          thanhCong: false,
          loi: 'Thiếu tham số nghiệp vụ',
        },
      ],
      'cursor-danh-dau-qua-han': [
        {
          nhan: /mặc định/,
          thanhCong: true,
          kiemTra: ({ sau, truoc }) => {
            const quaHan = sau('Lượt mượn quá hạn');
            expect(quaHan.length).toBeGreaterThan(0);
            // mỗi lượt quá hạn (đang mở) được ghi đúng một dòng VI_PHAM hôm nay
            expect(sau('Số dòng VI_PHAM hôm nay')[0].so_dong).toBe(
              Number(truoc('Số dòng VI_PHAM hôm nay')[0].so_dong) +
                quaHan.length,
            );
          },
        },
      ],
      'cursor-thong-ke-muon': [
        {
          nhan: /mặc định/,
          thanhCong: true,
          kiemTra: async ({ ketQua }) => {
            // đối chiếu với truy vấn gộp độc lập: cursor phải liệt kê mọi SV/GV kèm số phiếu, số sách
            const mong = await db.query<Body>(
              `SELECT u.ma_nguoi_dung,
                      (SELECT COUNT(*) FROM phieu_muon p WHERE p.nguoi_dung_id = u.id) AS so_phieu_muon,
                      (SELECT COUNT(*) FROM ct_phieu_muon c JOIN phieu_muon p ON p.id = c.phieu_muon_id
                        WHERE p.nguoi_dung_id = u.id) AS so_sach_da_muon
               FROM nguoi_dung u
               WHERE u.loai_nguoi_dung IN ('SINH_VIEN', 'GIANG_VIEN')`,
            );
            const chuan = (rows: Body[]) =>
              rows
                .map((r) => [
                  String(r.ma_nguoi_dung),
                  Number(r.so_phieu_muon),
                  Number(r.so_sach_da_muon),
                ])
                .sort((x, y) => soSanhChuoi(String(x[0]), String(y[0])));
            expect(chuan(ketQua)).toEqual(chuan(mong));
          },
        },
      ],
      'cursor-het-han-dat-truoc': [
        {
          nhan: /mặc định/,
          thanhCong: true,
          kiemTra: ({ sau, truoc }) => {
            // lượt giữ đã quá hạn giữ phải chuyển HET_HAN; lượt còn hạn giữ nguyên
            const nay = Date.parse(homNay);
            const hetHanTruoc = new Map(
              truoc('dat_truoc').map((r) => [r.id, r]),
            );
            for (const r of sau('dat_truoc')) {
              const cu = hetHanTruoc.get(r.id);
              const quaHan =
                cu?.trang_thai === 'SAN_SANG_NHAN' &&
                cu.han_giu &&
                Date.parse(String(cu.han_giu)) < nay;
              expect(r.trang_thai).toBe(quaHan ? 'HET_HAN' : cu?.trang_thai);
            }
          },
        },
      ],
    };

    beforeAll(async () => {
      nguoiCho = await taoBanDoc(`DMW${sfx}`);
      const nguoiMuon = await taoBanDoc(`DMH${sfx}`);
      sachCoNguoiCho = await taoSach(`SW${sfx}`, 1);
      await muon(nguoiMuon.ma, sachCoNguoiCho.bans).expect(201); // hết bản sẵn sàng
      await http
        .post('/dat-truoc')
        .set(auth(nguoiCho.token))
        .send({ maSach: sachCoNguoiCho.ma })
        .expect(201);
      homNay = (
        await db.queryOne<{ d: string }>(
          "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d",
        )
      )?.d as string;
      tenBangCoSan = (
        await db.query<{ t: string }>(
          "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name",
        )
      ).map((r) => r.t);
    });

    it('DEMO-09 mỗi tình huống của cả 16 mục cho đúng kết quả nghiệp vụ và rollback hoàn toàn', async () => {
      const mucs = (await http.get('/demo').set(auth(thuThu)).expect(200))
        .body as Body[];
      expect(mucs).toHaveLength(16);
      // test phải mô tả tình huống cho đúng các mục trong catalog, không thừa không thiếu
      expect(mucs.map((m) => m.id).sort(soSanhChuoi)).toEqual(
        Object.keys(KY_VONG).sort(soSanhChuoi),
      );
      expect(tenBangCoSan.length).toBeGreaterThanOrEqual(15);

      const checksumDau = await checksumTatCa();
      // phòng checksum rỗng/sai khóa làm phép so sánh rollback luôn đúng
      expect(Object.keys(checksumDau).sort(soSanhChuoi)).toEqual(
        [...tenBangCoSan].sort(soSanhChuoi),
      );
      expect(Object.values(checksumDau).every((v) => /^\d+$/.test(v))).toBe(
        true,
      );
      let tongThanhCong = 0;
      let tongLoi = 0;

      for (const muc of mucs) {
        const chiTiet = (
          await http.get(`/demo/${muc.id}`).set(auth(thuThu)).expect(200)
        ).body as Body;
        expect(chiTiet.dinhNghia.length).toBeGreaterThan(0);
        const kyVong = KY_VONG[muc.id];
        const tinhHuong = chiTiet.tinhHuong as Body[];
        const cacLanChay = tinhHuong.length
          ? tinhHuong
          : [
              {
                nhan: 'mặc định',
                thamSo: Object.fromEntries(
                  (chiTiet.thamSo as Body[]).map((t) => [
                    t.ten,
                    t.macDinh ?? '',
                  ]),
                ),
              },
            ];
        expect(cacLanChay.map((t) => t.nhan)).toHaveLength(kyVong.length);

        for (const [i, th] of cacLanChay.entries()) {
          const ten = `${muc.id} / ${th.nhan}`;
          const kv = kyVong[i];
          expect(th.nhan, ten).toMatch(kv.nhan);
          const thamSo = { ...th.thamSo, ...ghiDeThamSo(muc.id, i) };
          const checksumTruoc = await checksumTatCa();

          const xem = await http
            .post(`/demo/${muc.id}/bang`)
            .set(auth(thuThu))
            .send({ thamSo })
            .expect(200);
          const chayMotLan = () =>
            http
              .post(`/demo/${muc.id}/chay`)
              .set(auth(thuThu))
              .send({ thamSo })
              .expect(200);
          const lanMot = (await chayMotLan()).body as Chay;
          const lanHai = (await chayMotLan()).body as Chay;

          // kết quả nghiệp vụ đúng theo tình huống
          expect(lanMot.thanhCong, `${ten}: ${lanMot.loi}`).toBe(kv.thanhCong);
          expect(lanMot.daHoanTac, ten).toBe(true);
          expect(lanMot.lenh, ten).toBeTruthy();
          if (kv.thanhCong) {
            tongThanhCong++;
            expect(lanMot.loi, ten).toBeNull();
          } else {
            tongLoi++;
            expect(lanMot.loi, ten).toBe(kv.loi);
            // tình huống lỗi không được để lại thay đổi nào ở các bảng liên quan
            expect(lanMot.bangSau, ten).toEqual(xem.body.bang);
          }

          const tim = (bang: Body[]) => (nhan: string) => {
            const t = bang.find((x) => String(x.nhan).startsWith(nhan));
            if (!t) throw new Error(`${ten}: không có bảng "${nhan}"`);
            return t.dong as Body[];
          };
          if (kv.kiemTra) {
            await kv.kiemTra({
              sau: tim(lanMot.bangSau),
              truoc: tim(xem.body.bang),
              ketQua: (lanMot.ketQua?.dong ?? []) as Body[],
              chay: lanMot,
            });
          }

          // chạy lần hai cho cùng kết quả (rollback thật sự lặp lại được)
          expect(lanHai.thanhCong, ten).toBe(lanMot.thanhCong);
          expect(lanHai.loi, ten).toBe(lanMot.loi);
          expect(lanHai.ketQua, ten).toEqual(lanMot.ketQua);
          // id tự tăng của dòng mới khác nhau giữa hai lần chạy nên chỉ so số dòng từng bảng
          expect(
            lanHai.bangSau.map((x: Body) => x.dong.length),
            ten,
          ).toEqual(lanMot.bangSau.map((x: Body) => x.dong.length));

          // rollback: nội dung mọi bảng giống hệt trước khi chạy
          expect(await checksumTatCa(), ten).toEqual(checksumTruoc);
        }

        // thiếu tham số bắt buộc -> 400
        if ((chiTiet.thamSo as Body[]).some((t) => !t.tuyChon)) {
          await http
            .post(`/demo/${muc.id}/chay`)
            .set(auth(thuThu))
            .send({ thamSo: {} })
            .expect(400);
        }
      }

      expect(tongThanhCong).toBeGreaterThan(0);
      expect(tongLoi).toBeGreaterThan(0);
      await http.get('/demo/khong-co').set(auth(thuThu)).expect(404);
      await http.get('/demo').set(auth(docGiaChung.token)).expect(403);
      expect(await checksumTatCa()).toEqual(checksumDau);
    }, 180_000);
  });
});

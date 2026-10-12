import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import '../src/common/bigint-json.js';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type Operation = readonly [HttpMethod, string];

const ACTIVE_USERS = [
  ['ad001', 'AD001@Nhom8', 'AD001', 'ADMIN'],
  ['cb001', 'CB001@Nhom8', 'CB001', 'THU_THU'],
  ['cb002', 'CB002@Nhom8', 'CB002', 'THU_THU'],
  ['gv001', 'GV001@Nhom8', 'GV001', 'BAN_DOC'],
  ['gv002', 'GV002@Nhom8', 'GV002', 'BAN_DOC'],
  ['sv001', 'SV001@Nhom8', 'SV001', 'BAN_DOC'],
  ['sv002', 'SV002@Nhom8', 'SV002', 'BAN_DOC'],
  ['sv003', 'SV003@Nhom8', 'SV003', 'BAN_DOC'],
  ['sv004', 'SV004@Nhom8', 'SV004', 'BAN_DOC'],
  ['sv005', 'SV005@Nhom8', 'SV005', 'BAN_DOC'],
  ['sv006', 'SV006@Nhom8', 'SV006', 'BAN_DOC'],
  ['sv008', 'SV008@Nhom8', 'SV008', 'BAN_DOC'],
] as const;

const AUTHENTICATED: Operation[] = [
  ['GET', '/auth/me'],
  ['GET', '/the-loai'],
  ['GET', '/the-loai/1'],
  ['GET', '/nha-xuat-ban'],
  ['GET', '/nha-xuat-ban/1'],
  ['GET', '/tac-gia'],
  ['GET', '/tac-gia/1'],
  ['GET', '/sach'],
  ['GET', '/sach/1'],
  ['GET', '/phieu-muon/PM000001'],
  ['POST', '/muon-tra/gia-han'],
  ['POST', '/dat-truoc'],
  ['GET', '/dat-truoc'],
  ['DELETE', '/dat-truoc/S001'],
  ['GET', '/me/sach-dang-muon'],
  ['GET', '/me/tien-phat'],
  ['GET', '/me/lich-su-muon'],
  ['GET', '/me/dat-truoc'],
];

const STAFF: Operation[] = [
  ['POST', '/docgia'],
  ['GET', '/docgia'],
  ['GET', '/docgia/1'],
  ['PATCH', '/docgia/1'],
  ['DELETE', '/docgia/1'],
  ['PATCH', '/docgia/1/trang-thai'],
  ['POST', '/the-loai'],
  ['PATCH', '/the-loai/1'],
  ['POST', '/nha-xuat-ban'],
  ['PATCH', '/nha-xuat-ban/1'],
  ['POST', '/tac-gia'],
  ['PATCH', '/tac-gia/1'],
  ['POST', '/sach'],
  ['PATCH', '/sach/1'],
  ['DELETE', '/sach/1'],
  ['GET', '/sach/1/ban-sach'],
  ['POST', '/sach/1/ban-sach'],
  ['GET', '/ban-sach'],
  ['GET', '/ban-sach/BS001'],
  ['PATCH', '/ban-sach/BS001/tinh-trang'],
  ['POST', '/phieu-muon'],
  ['GET', '/phieu-muon'],
  ['POST', '/phieu-muon/PM000001/huy'],
  ['POST', '/muon-tra/tra'],
  ['GET', '/phat'],
  ['POST', '/phat/1/thanh-toan'],
  ['GET', '/bao-cao/danh-muc-sach'],
  ['GET', '/bao-cao/sach-dang-muon'],
  ['GET', '/bao-cao/muon-qua-han'],
  ['GET', '/bao-cao/nguoi-dung-vi-pham'],
  ['GET', '/bao-cao/top-sach-muon-nhieu'],
  ['GET', '/bao-cao/thong-ke-tien-phat'],
  ['GET', '/bao-cao/lich-su-muon'],
  ['GET', '/bao-cao/dat-truoc'],
  ['GET', '/demo'],
  ['GET', '/demo/fn-tien-phat-qua-han'],
  ['POST', '/demo/fn-tien-phat-qua-han/bang'],
  ['POST', '/demo/fn-tien-phat-qua-han/chay'],
];

const ADMIN_ONLY: Operation[] = [
  ['POST', '/docgia/1/tai-khoan'],
  ['PATCH', '/docgia/1/tai-khoan/trang-thai'],
  ['DELETE', '/the-loai/1'],
  ['DELETE', '/nha-xuat-ban/1'],
  ['DELETE', '/tac-gia/1'],
  ['POST', '/phat/1/huy'],
];

const REPORTS = STAFF.filter(([, path]) => path.startsWith('/bao-cao/'));

describe('Toàn bộ tài khoản seed, RBAC và demo (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let admin: string;
  let thuThu: string;
  let banDoc: string;

  const call = (method: HttpMethod, path: string) => {
    switch (method) {
      case 'GET':
        return http.get(path);
      case 'POST':
        return http.post(path);
      case 'PATCH':
        return http.patch(path);
      case 'DELETE':
        return http.delete(path);
    }
  };

  const login = async (tenDangNhap: string, matKhau: string) => {
    const response = await http
      .post('/auth/login')
      .send({ tenDangNhap, matKhau })
      .expect(200);
    return response.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.listen(0, '127.0.0.1');
    http = request(app.getHttpServer());
    admin = await login('ad001', 'AD001@Nhom8');
    thuThu = await login('cb001', 'CB001@Nhom8');
    banDoc = await login('sv001', 'SV001@Nhom8');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('tài khoản trong user.md', () => {
    it.each(ACTIVE_USERS)(
      '%s đăng nhập đúng identity và vai trò',
      async (tenDangNhap, matKhau, maNguoiDung, vaiTro) => {
        const response = await http
          .post('/auth/login')
          .send({ tenDangNhap, matKhau })
          .expect(200);

        expect(response.body.accessToken).toEqual(expect.any(String));
        expect(response.body.user).toMatchObject({
          maNguoiDung,
          tenDangNhap,
          vaiTro,
        });
      },
    );

    it('sv007 bị khóa nên không đăng nhập được', async () => {
      const response = await http
        .post('/auth/login')
        .send({ tenDangNhap: 'sv007', matKhau: 'SV007@Nhom8' })
        .expect(401);
      expect(response.body.accessToken).toBeUndefined();
    });
  });

  describe('ma trận xác thực và phân quyền của 64 API', () => {
    it.each([...AUTHENTICATED, ...STAFF, ...ADMIN_ONLY])(
      '%s %s từ chối request không có token',
      async (method, path) => {
        await call(method, path).send({}).expect(401);
      },
    );

    it.each(STAFF)(
      '%s %s từ chối BAN_DOC trước khi xử lý dữ liệu',
      async (method, path) => {
        await call(method, path)
          .set({ Authorization: `Bearer ${banDoc}` })
          .send({})
          .expect(403);
      },
    );

    it.each(ADMIN_ONLY)(
      '%s %s từ chối THU_THU trước khi xử lý dữ liệu',
      async (method, path) => {
        await call(method, path)
          .set({ Authorization: `Bearer ${thuThu}` })
          .send({})
          .expect(403);
      },
    );
  });

  describe('báo cáo live cho nhân viên', () => {
    it.each(REPORTS)(
      '%s trả dữ liệu cho THU_THU',
      async (_method, path) => {
        const response = await http
          .get(path)
          .set({ Authorization: `Bearer ${thuThu}` })
          .expect(200);
        expect(response.body).toBeDefined();
      },
    );
  });

  describe('demo B1-B5 trên CSDL thật', () => {
    it('liệt kê đủ 16 mục procedure, trigger, function và cursor', async () => {
      const response = await http
        .get('/demo')
        .set({ Authorization: `Bearer ${admin}` })
        .expect(200);
      expect(response.body).toHaveLength(16);
      expect(new Set(response.body.map((item: { loai: string }) => item.loai))).toEqual(
        new Set(['PROCEDURE', 'TRIGGER', 'FUNCTION', 'CURSOR']),
      );
    });

    it('đọc chi tiết và bảng liên quan của function từ DB', async () => {
      const detail = await http
        .get('/demo/fn-tien-phat-qua-han')
        .set({ Authorization: `Bearer ${thuThu}` })
        .expect(200);
      expect(detail.body).toMatchObject({
        id: 'fn-tien-phat-qua-han',
        loai: 'FUNCTION',
      });
      expect(detail.body.dinhNghia.length).toBeGreaterThan(0);

      const tables = await http
        .post('/demo/fn-tien-phat-qua-han/bang')
        .set({ Authorization: `Bearer ${thuThu}` })
        .send({
          thamSo: { han_tra: '2026-09-26', ngay_tra: '2026-10-07' },
        })
        .expect(200);
      expect(tables.body.bang[0].dong.length).toBeGreaterThan(0);
    });

    it('chạy function và hoàn tác theo mặc định', async () => {
      const response = await http
        .post('/demo/fn-tien-phat-qua-han/chay')
        .set({ Authorization: `Bearer ${admin}` })
        .send({
          thamSo: { han_tra: '2026-09-26', ngay_tra: '2026-10-07' },
        })
        .expect(200);
      expect(response.body).toMatchObject({
        thanhCong: true,
        loi: null,
        daHoanTac: true,
      });
      expect(response.body.ketQua.dong).toEqual([
        { so_ngay_qua_han: 11, tien_phat: 55000 },
      ]);
    });

    it('giữ lỗi nghiệp vụ trong kết quả để trình diễn bước 5', async () => {
      const response = await http
        .post('/demo/fn-tham-so/chay')
        .set({ Authorization: `Bearer ${admin}` })
        .send({ thamSo: { ma_tham_so: 'KHONG_CO' } })
        .expect(200);
      expect(response.body).toMatchObject({
        thanhCong: false,
        daHoanTac: true,
      });
      expect(response.body.loi).toEqual(expect.any(String));
    });

    it('từ chối id demo và tham số ngày không hợp lệ', async () => {
      await http
        .get('/demo/khong-co')
        .set({ Authorization: `Bearer ${admin}` })
        .expect(404);
      await http
        .post('/demo/fn-tien-phat-qua-han/chay')
        .set({ Authorization: `Bearer ${admin}` })
        .send({ thamSo: { han_tra: '12/10/2026', ngay_tra: '' } })
        .expect(400);
    });
  });
});

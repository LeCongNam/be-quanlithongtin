import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import '../src/common/bigint-json.js';

/**
 * Token đã cấp không còn dùng được ngay khi tài khoản hoặc người dùng bị khóa
 * (guard đọc trạng thái trong DB ở mỗi request, không chờ JWT hết hạn).
 * Chạy trên DB thật có seed (xem library.e2e-spec.ts).
 */
const sfx = Date.now().toString(36).toUpperCase().slice(-7);
const PASSWORD = 'MatKhau-Test-1';

describe('Token và trạng thái tài khoản (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let admin: string;
  let thuThu: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (tenDangNhap: string, matKhau: string) => {
    const res = await http
      .post('/auth/login')
      .send({ tenDangNhap, matKhau })
      .expect(200);
    return res.body.accessToken as string;
  };

  /** Tạo bạn đọc có tài khoản, đăng nhập sẵn: trả id, tên đăng nhập và token. */
  const taoBanDoc = async (ma: string) => {
    const dg = await http
      .post('/docgia')
      .set(auth(admin))
      .send({
        maNguoiDung: ma,
        hoTen: `Doc gia ${ma}`,
        loaiNguoiDung: 'SINH_VIEN',
      })
      .expect(201);
    await http
      .post(`/docgia/${dg.body.id}/tai-khoan`)
      .set(auth(admin))
      .send({ matKhau: PASSWORD })
      .expect(201);
    const tenDangNhap = ma.toLowerCase();
    return {
      id: dg.body.id as string,
      tenDangNhap,
      token: await login(tenDangNhap, PASSWORD),
    };
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
    admin = await login('ad001', 'AD001@Nhom8');
    thuThu = await login('cb001', 'CB001@Nhom8');
  });

  afterAll(async () => {
    await app.close();
  });

  it('khóa tài khoản: token cũ bị từ chối ngay, mở lại thì dùng tiếp được', async () => {
    const { id, token } = await taoBanDoc(`TA${sfx}`);
    await http.get('/auth/me').set(auth(token)).expect(200);

    await http
      .patch(`/docgia/${id}/tai-khoan/trang-thai`)
      .set(auth(admin))
      .send({ trangThai: 'KHOA' })
      .expect(200);
    await http.get('/auth/me').set(auth(token)).expect(401);
    await http.get('/me/sach-dang-muon').set(auth(token)).expect(401);

    await http
      .patch(`/docgia/${id}/tai-khoan/trang-thai`)
      .set(auth(admin))
      .send({ trangThai: 'HOAT_DONG' })
      .expect(200);
    await http.get('/auth/me').set(auth(token)).expect(200);
  });

  it('tạm khóa người dùng (trigger khóa luôn tài khoản): token cũ bị từ chối', async () => {
    const { id, token } = await taoBanDoc(`TB${sfx}`);

    await http
      .patch(`/docgia/${id}/trang-thai`)
      .set(auth(thuThu))
      .send({ trangThai: 'TAM_KHOA' })
      .expect(200);

    await http.get('/auth/me').set(auth(token)).expect(401);
  });

  it('thủ thư bị khóa cũng mất quyền ngay, kể cả ở khu vực thủ thư', async () => {
    const cb = await http
      .post('/docgia')
      .set(auth(admin))
      .send({
        maNguoiDung: `TC${sfx}`,
        hoTen: `Can bo TC${sfx}`,
        loaiNguoiDung: 'CAN_BO',
      })
      .expect(201);
    await http
      .post(`/docgia/${cb.body.id}/tai-khoan`)
      .set(auth(admin))
      .send({ matKhau: PASSWORD })
      .expect(201);
    const token = await login(`tc${sfx}`.toLowerCase(), PASSWORD);
    await http.get('/docgia').set(auth(token)).expect(200);

    await http
      .patch(`/docgia/${cb.body.id}/tai-khoan/trang-thai`)
      .set(auth(admin))
      .send({ trangThai: 'KHOA' })
      .expect(200);

    await http.get('/docgia').set(auth(token)).expect(401);
  });

  it('token hợp lệ của tài khoản đang hoạt động không bị ảnh hưởng', async () => {
    await http.get('/auth/me').set(auth(admin)).expect(200);
    await http.get('/auth/me').set(auth(thuThu)).expect(200);
  });
});

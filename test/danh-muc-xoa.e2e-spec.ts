import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import '../src/common/bigint-json.js';

/**
 * Role r_qltv_thuthu chỉ có SELECT/INSERT/UPDATE trên the_loai, nha_xuat_ban, tac_gia (sql/08_security.sql),
 * nên API cũng chỉ cho ADMIN xóa; thủ thư vẫn thêm/sửa được.
 * Chạy trên DB thật có seed (xem library.e2e-spec.ts).
 */
const sfx = Date.now().toString(36).toUpperCase().slice(-7);

const DANH_MUC = [
  {
    path: 'the-loai',
    tao: (ma: string) => ({ maTheLoai: ma, tenTheLoai: `The loai ${ma}` }),
    sua: { tenTheLoai: 'Ten moi' },
  },
  {
    path: 'nha-xuat-ban',
    tao: (ma: string) => ({ maNxb: ma, tenNxb: `NXB ${ma}` }),
    sua: { tenNxb: 'Ten moi' },
  },
  {
    path: 'tac-gia',
    tao: (ma: string) => ({ maTacGia: ma, tenTacGia: `Tac gia ${ma}` }),
    sua: { tenTacGia: 'Ten moi' },
  },
] as const;

describe('Xóa danh mục chỉ dành cho ADMIN (e2e)', () => {
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

  for (const { path, tao, sua } of DANH_MUC) {
    describe(path, () => {
      it('thủ thư thêm và sửa được nhưng không xóa được (403, bản ghi còn nguyên)', async () => {
        const created = await http
          .post(`/${path}`)
          .set(auth(thuThu))
          .send(tao(`DX${sfx}`))
          .expect(201);
        await http
          .patch(`/${path}/${created.body.id}`)
          .set(auth(thuThu))
          .send(sua)
          .expect(200);

        await http
          .delete(`/${path}/${created.body.id}`)
          .set(auth(thuThu))
          .expect(403);
        await http
          .get(`/${path}/${created.body.id}`)
          .set(auth(thuThu))
          .expect(200);
      });

      it('admin xóa được', async () => {
        const created = await http
          .post(`/${path}`)
          .set(auth(admin))
          .send(tao(`DY${sfx}`))
          .expect(201);

        await http
          .delete(`/${path}/${created.body.id}`)
          .set(auth(admin))
          .expect(200);
        await http
          .get(`/${path}/${created.body.id}`)
          .set(auth(admin))
          .expect(404);
      });
    });
  }
});

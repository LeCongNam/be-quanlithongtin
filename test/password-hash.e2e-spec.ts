import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import '../src/common/bigint-json.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Mật khẩu chỉ có MỘT định dạng: SHA2(muoi + mat_khau, 256), đúng như sp_dang_nhap (sql/04_procedures.sql).
 * BE ghi/đọc cùng định dạng này nên tài khoản tạo hoặc đăng nhập qua web vẫn đăng nhập được ở tầng CSDL.
 * Chạy trên DB thật có seed (xem library.e2e-spec.ts).
 */
const sfx = Date.now().toString(36).toUpperCase().slice(-7);
const PASSWORD = 'MatKhau-Test-1';
const PASSWORD_VI = 'Mật-Khẩu-Tiếng-Việt-1';
const SHA2_HEX = /^[0-9a-f]{64}$/;

describe('Băm mật khẩu thống nhất với sp_dang_nhap (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let admin: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Gọi thẳng sp_dang_nhap như user bạn đọc; trả token, hoặc null nếu CSDL từ chối. */
  const dangNhapCsdl = async (tenDangNhap: string, matKhau: string) => {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`CALL sp_dang_nhap(${tenDangNhap}, ${matKhau}, @tok)`;
        const [{ tok }] = await tx.$queryRaw<
          { tok: string | null }[]
        >`SELECT @tok AS tok`;
        return tok;
      });
    } catch {
      return null;
    }
  };

  const hashTrongDb = async (tenDangNhap: string) =>
    (await prisma.taiKhoan.findUniqueOrThrow({ where: { tenDangNhap } }))
      .matKhauHash;

  const dangNhapWeb = (tenDangNhap: string, matKhau: string) =>
    http.post('/auth/login').send({ tenDangNhap, matKhau });

  const taoDocGia = async (ma: string, matKhau: string) => {
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
      .send({ matKhau })
      .expect(201);
    return ma.toLowerCase();
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
    prisma = app.get(PrismaService);
    const res = await dangNhapWeb('ad001', 'AD001@Nhom8').expect(200);
    admin = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('đăng nhập web bằng tài khoản seed không đổi hash; sp_dang_nhap vẫn dùng được', async () => {
    const truoc = await hashTrongDb('sv002');
    expect(truoc).toMatch(SHA2_HEX);

    await dangNhapWeb('sv002', 'SV002@Nhom8').expect(200);

    expect(await hashTrongDb('sv002')).toBe(truoc);
    expect(await dangNhapCsdl('sv002', 'SV002@Nhom8')).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it('tài khoản tạo qua API lưu SHA2 và đăng nhập được ở tầng CSDL', async () => {
    const user = await taoDocGia(`PA${sfx}`, PASSWORD);

    expect(await hashTrongDb(user)).toMatch(SHA2_HEX);
    expect(await dangNhapCsdl(user, PASSWORD)).toMatch(/^[0-9a-f]{64}$/);
    await dangNhapWeb(user, PASSWORD).expect(200);
  });

  it('mật khẩu tiếng Việt có dấu khớp giữa BE và CSDL', async () => {
    const user = await taoDocGia(`PB${sfx}`, PASSWORD_VI);

    expect(await dangNhapCsdl(user, PASSWORD_VI)).toMatch(/^[0-9a-f]{64}$/);
    await dangNhapWeb(user, PASSWORD_VI).expect(200);
  });

  it('tài khoản đã bị đổi sang bcrypt: đăng nhập đúng một lần thì trở về SHA2', async () => {
    const user = await taoDocGia(`PC${sfx}`, PASSWORD);
    await prisma.taiKhoan.update({
      where: { tenDangNhap: user },
      data: { matKhauHash: await bcrypt.hash(PASSWORD, 4) },
    });
    expect(await dangNhapCsdl(user, PASSWORD)).toBeNull();

    await dangNhapWeb(user, PASSWORD).expect(200);

    expect(await hashTrongDb(user)).toMatch(SHA2_HEX);
    expect(await dangNhapCsdl(user, PASSWORD)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sai mật khẩu -> 401 và không đổi hash, ở cả định dạng SHA2 lẫn bcrypt cũ', async () => {
    const sha = await taoDocGia(`PD${sfx}`, PASSWORD);
    const cu = await taoDocGia(`PE${sfx}`, PASSWORD);
    const hashCu = await bcrypt.hash(PASSWORD, 4);
    await prisma.taiKhoan.update({
      where: { tenDangNhap: cu },
      data: { matKhauHash: hashCu },
    });
    const hashSha = await hashTrongDb(sha);

    await dangNhapWeb(sha, 'sai-mat-khau').expect(401);
    await dangNhapWeb(cu, 'sai-mat-khau').expect(401);

    expect(await hashTrongDb(sha)).toBe(hashSha);
    expect(await hashTrongDb(cu)).toBe(hashCu);
  });
});

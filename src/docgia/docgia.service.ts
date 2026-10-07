import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { hashMatKhau } from '../common/password.js';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import {
  LoaiNguoiDung,
  TrangThaiNguoiDung,
  TrangThaiTaiKhoan,
  VaiTroTaiKhoan,
} from '../common/db-enums.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDocgiaDto } from './dto/create-docgia.dto.js';
import { CreateTaiKhoanDto } from './dto/create-tai-khoan.dto.js';
import { DOCGIA_SAP_XEP, ListDocgiaQueryDto } from './dto/docgia-query.dto.js';
import { UpdateDocgiaDto } from './dto/update-docgia.dto.js';
import { parseSapXep } from '../common/dto/sap-xep.js';

// Không bao giờ trả mat_khau_hash / muoi ra ngoài.
const TAI_KHOAN_PUBLIC = {
  select: { tenDangNhap: true, vaiTro: true, trangThai: true },
} as const;

@Injectable()
export class DocgiaService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateDocgiaDto) {
    return this.prisma.nguoiDung.create({
      data: {
        maNguoiDung: dto.maNguoiDung,
        hoTen: dto.hoTen,
        loaiNguoiDung: dto.loaiNguoiDung,
        email: dto.email?.trim() || null,
        sdt: dto.sdt?.trim() || null,
        khoaDonVi: dto.khoaDonVi?.trim() || null,
      },
    });
  }

  async findAll(q: ListDocgiaQueryDto) {
    const sx = parseSapXep<(typeof DOCGIA_SAP_XEP)[number]>(q.sapXep);
    const where: Prisma.NguoiDungWhereInput = {
      loaiNguoiDung: q.loaiNguoiDung,
      trangThai: q.trangThai,
      OR: q.tuKhoa
        ? [
            { maNguoiDung: { contains: q.tuKhoa } },
            { hoTen: { contains: q.tuKhoa } },
            { email: { contains: q.tuKhoa } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.nguoiDung.findMany({
        where,
        orderBy: sx
          ? [{ [sx.field]: sx.dir }, { id: sx.dir }]
          : { maNguoiDung: 'asc' },
        ...skipTake(q),
      }),
      this.prisma.nguoiDung.count({ where }),
    ]);
    return paginate(data, total, q);
  }

  async findOne(id: bigint) {
    const docgia = await this.prisma.nguoiDung.findUnique({
      where: { id },
      include: { taiKhoan: TAI_KHOAN_PUBLIC },
    });
    if (!docgia) throw new NotFoundException('Không tìm thấy người dùng');
    return docgia;
  }

  update(id: bigint, dto: UpdateDocgiaDto) {
    return this.prisma.nguoiDung.update({
      where: { id },
      data: {
        maNguoiDung: dto.maNguoiDung,
        hoTen: dto.hoTen,
        loaiNguoiDung: dto.loaiNguoiDung,
        email: dto.email === undefined ? undefined : dto.email.trim() || null,
        sdt: dto.sdt,
        khoaDonVi: dto.khoaDonVi,
      },
    });
  }

  /**
   * Bạn đọc: qua sp_doi_trang_thai_nguoi_dung (ghi nhật ký DOI_TRANG_THAI_ND). Cán bộ: procedure từ chối,
   * chỉ quản trị đổi trực tiếp. Khi người dùng rời HOAT_DONG, trg_nguoi_dung_au tự khóa tài khoản;
   * quay lại HOAT_DONG thì tài khoản vẫn KHOA, quản trị phải mở riêng (doiTrangThaiTaiKhoan).
   */
  async doiTrangThai(
    id: bigint,
    trangThai: TrangThaiNguoiDung,
    user: AuthUser,
  ) {
    const nd = await this.findOne(id);
    if (nd.loaiNguoiDung === LoaiNguoiDung.CAN_BO) {
      if (user.vaiTro !== VaiTroTaiKhoan.ADMIN)
        throw new ForbiddenException('Chỉ quản trị viên được đổi trạng thái cán bộ');
      await this.prisma.nguoiDung.update({
        where: { id },
        data: { trangThai },
      });
    } else {
      await this.prisma
        .$executeRaw`CALL sp_doi_trang_thai_nguoi_dung(${nd.maNguoiDung}, ${trangThai})`;
    }
    return this.findOne(id);
  }

  /** Không xóa cứng (còn phiếu mượn/phạt tham chiếu): chuyển sang NGUNG, trigger khóa tài khoản theo. */
  remove(id: bigint, user: AuthUser) {
    return this.doiTrangThai(id, TrangThaiNguoiDung.NGUNG, user);
  }

  /** Chỉ quản trị. trg_tai_khoan_bu từ chối mở tài khoản khi người dùng chưa HOAT_DONG (422). */
  async doiTrangThaiTaiKhoan(id: bigint, trangThai: TrangThaiTaiKhoan) {
    const taiKhoan = await this.prisma.taiKhoan.findUnique({
      where: { nguoiDungId: id },
    });
    if (!taiKhoan) throw new NotFoundException('Người dùng chưa có tài khoản');
    return this.prisma.taiKhoan.update({
      where: { nguoiDungId: id },
      data: { trangThai },
      ...TAI_KHOAN_PUBLIC,
    });
  }

  async taoTaiKhoan(id: bigint, dto: CreateTaiKhoanDto) {
    const nguoiDung = await this.prisma.nguoiDung.findUnique({
      where: { id },
      include: { taiKhoan: true },
    });
    if (!nguoiDung) throw new NotFoundException('Không tìm thấy người dùng');
    if (nguoiDung.taiKhoan)
      throw new ConflictException('Người dùng đã có tài khoản');

    const vaiTro =
      dto.vaiTro ??
      (nguoiDung.loaiNguoiDung === LoaiNguoiDung.CAN_BO
        ? VaiTroTaiKhoan.THU_THU
        : VaiTroTaiKhoan.BAN_DOC);

    const muoi = randomBytes(16).toString('hex');
    return this.prisma.taiKhoan.create({
      data: {
        nguoiDungId: id,
        tenDangNhap: dto.tenDangNhap ?? nguoiDung.maNguoiDung.toLowerCase(),
        muoi,
        matKhauHash: hashMatKhau(muoi, dto.matKhau),
        vaiTro,
        trangThai: TrangThaiTaiKhoan.HOAT_DONG,
      },
      ...TAI_KHOAN_PUBLIC,
    });
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import {
  LoaiNguoiDung,
  TrangThaiNguoiDung,
  TrangThaiTaiKhoan,
  VaiTroTaiKhoan,
} from '../common/db-enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDocgiaDto } from './dto/create-docgia.dto.js';
import { CreateTaiKhoanDto } from './dto/create-tai-khoan.dto.js';
import { ListDocgiaQueryDto } from './dto/docgia-query.dto.js';
import { UpdateDocgiaDto } from './dto/update-docgia.dto.js';

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
        trangThai: dto.trangThai,
        email: dto.email?.trim() || null,
        sdt: dto.sdt?.trim() || null,
        khoaDonVi: dto.khoaDonVi?.trim() || null,
      },
    });
  }

  async findAll(q: ListDocgiaQueryDto) {
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
        orderBy: { maNguoiDung: 'asc' },
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
    if (!docgia) throw new NotFoundException('Khong tim thay nguoi dung');
    return docgia;
  }

  update(id: bigint, dto: UpdateDocgiaDto) {
    return this.prisma.nguoiDung.update({
      where: { id },
      data: {
        maNguoiDung: dto.maNguoiDung,
        hoTen: dto.hoTen,
        loaiNguoiDung: dto.loaiNguoiDung,
        trangThai: dto.trangThai,
        email: dto.email === undefined ? undefined : dto.email.trim() || null,
        sdt: dto.sdt,
        khoaDonVi: dto.khoaDonVi,
      },
    });
  }

  /** Không xóa cứng (còn phiếu mượn/phạt tham chiếu): chuyển sang NGUNG và khóa tài khoản. */
  async remove(id: bigint) {
    return this.prisma.$transaction(async (tx) => {
      await tx.taiKhoan.updateMany({
        where: { nguoiDungId: id },
        data: { trangThai: TrangThaiTaiKhoan.KHOA },
      });
      return tx.nguoiDung.update({
        where: { id },
        data: { trangThai: TrangThaiNguoiDung.NGUNG },
      });
    });
  }

  async taoTaiKhoan(id: bigint, dto: CreateTaiKhoanDto) {
    const nguoiDung = await this.prisma.nguoiDung.findUnique({
      where: { id },
      include: { taiKhoan: true },
    });
    if (!nguoiDung) throw new NotFoundException('Khong tim thay nguoi dung');
    if (nguoiDung.taiKhoan)
      throw new ConflictException('Nguoi dung da co tai khoan');

    const vaiTro =
      dto.vaiTro ??
      (nguoiDung.loaiNguoiDung === LoaiNguoiDung.CAN_BO
        ? VaiTroTaiKhoan.THU_THU
        : VaiTroTaiKhoan.BAN_DOC);

    return this.prisma.taiKhoan.create({
      data: {
        nguoiDungId: id,
        tenDangNhap: dto.tenDangNhap ?? nguoiDung.maNguoiDung.toLowerCase(),
        muoi: randomBytes(16).toString('hex'),
        matKhauHash: await bcrypt.hash(dto.matKhau, 10),
        vaiTro,
        trangThai: TrangThaiTaiKhoan.HOAT_DONG,
      },
      ...TAI_KHOAN_PUBLIC,
    });
  }
}

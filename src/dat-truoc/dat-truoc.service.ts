import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isStaff, resolveMaNguoiDung } from '../common/auth-helpers.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import { TrangThaiDatTruoc } from '../common/db-enums.js';
import { pagePriorityFirst } from '../common/priority-page.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DatTruocDto, ListDatTruocQueryDto } from './dto/dat-truoc.dto.js';

const INCLUDE = {
  sach: { select: { maSach: true, tenSach: true } },
  nguoiDung: { select: { maNguoiDung: true, hoTen: true } },
} satisfies Prisma.DatTruocInclude;

/** Lượt còn hiệu lực (đang chờ / sẵn sàng nhận): đứng trước các lượt đã đóng, giống `/me/dat-truoc`. */
const DANG_CHO = [
  TrangThaiDatTruoc.CHO_XU_LY,
  TrangThaiDatTruoc.SAN_SANG_NHAN,
];
const MOI_NHAT_TRUOC = [
  { ngayDat: 'desc' },
  { id: 'desc' },
] satisfies Prisma.DatTruocOrderByWithRelationInput[];

@Injectable()
export class DatTruocService {
  constructor(private readonly prisma: PrismaService) {}

  async datTruoc(dto: DatTruocDto, user: AuthUser) {
    const maNguoiDung = resolveMaNguoiDung(user, dto.maNguoiDung);
    await this.prisma
      .$executeRaw`CALL sp_dat_truoc(${maNguoiDung}, ${dto.maSach})`;
    return this.prisma.datTruoc.findFirst({
      where: { sach: { maSach: dto.maSach }, nguoiDung: { maNguoiDung } },
      orderBy: { id: 'desc' },
      include: INCLUDE,
    });
  }

  async huyDatTruoc(
    maSach: string,
    user: AuthUser,
    maNguoiDungYeuCau?: string,
  ) {
    const maNguoiDung = resolveMaNguoiDung(user, maNguoiDungYeuCau);
    await this.prisma
      .$executeRaw`CALL sp_huy_dat_truoc(${maNguoiDung}, ${maSach})`;
    return { maSach, maNguoiDung, trangThai: 'HUY' };
  }

  async list(q: ListDatTruocQueryDto, user: AuthUser) {
    const where: Prisma.DatTruocWhereInput = {
      trangThai: q.trangThai,
      // Bạn đọc luôn bị giới hạn vào đặt trước của chính mình
      nguoiDung: isStaff(user)
        ? q.maNguoiDung
          ? { maNguoiDung: q.maNguoiDung }
          : undefined
        : { maNguoiDung: user.maNguoiDung },
    };
    const dangCho: Prisma.DatTruocWhereInput = {
      AND: [where, { trangThai: { in: DANG_CHO } }],
    };
    const daDong: Prisma.DatTruocWhereInput = {
      AND: [where, { trangThai: { notIn: DANG_CHO } }],
    };
    const { data, total } = await pagePriorityFirst({
      ...skipTake(q),
      countFirst: () => this.prisma.datTruoc.count({ where: dangCho }),
      countRest: () => this.prisma.datTruoc.count({ where: daDong }),
      findFirst: (skip, take) =>
        this.prisma.datTruoc.findMany({
          where: dangCho,
          include: INCLUDE,
          orderBy: MOI_NHAT_TRUOC,
          skip,
          take,
        }),
      findRest: (skip, take) =>
        this.prisma.datTruoc.findMany({
          where: daDong,
          include: INCLUDE,
          orderBy: MOI_NHAT_TRUOC,
          skip,
          take,
        }),
    });
    return paginate(data, total, q);
  }
}

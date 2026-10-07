import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import { TrangThaiPhieuPhat } from '../common/db-enums.js';
import { pagePriorityFirst } from '../common/priority-page.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListPhatQueryDto, PHAT_SAP_XEP } from './dto/phat.dto.js';
import { parseSapXep } from '../common/dto/sap-xep.js';

const INCLUDE = {
  ctPhieuMuon: {
    select: {
      banSach: {
        select: { maBanSach: true, sach: { select: { tenSach: true } } },
      },
      phieuMuon: {
        select: {
          maPhieu: true,
          nguoiDung: { select: { maNguoiDung: true, hoTen: true } },
        },
      },
    },
  },
} satisfies Prisma.PhieuPhatInclude;

const MOI_NHAT_TRUOC = [
  { ngayTao: 'desc' },
  { id: 'desc' },
] satisfies Prisma.PhieuPhatOrderByWithRelationInput[];

@Injectable()
export class PhatService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListPhatQueryDto) {
    const where: Prisma.PhieuPhatWhereInput = {
      trangThai: q.trangThai,
      ctPhieuMuon: q.maNguoiDung
        ? { phieuMuon: { nguoiDung: { maNguoiDung: q.maNguoiDung } } }
        : undefined,
    };
    const sx = parseSapXep<(typeof PHAT_SAP_XEP)[number]>(q.sapXep);
    if (sx) {
      // Người dùng chọn cột: sort thuần theo cột, không ưu tiên nhóm
      const [data, total] = await Promise.all([
        this.prisma.phieuPhat.findMany({
          where,
          include: INCLUDE,
          orderBy: [{ [sx.field]: sx.dir }, { id: sx.dir }],
          ...skipTake(q),
        }),
        this.prisma.phieuPhat.count({ where }),
      ]);
      return paginate(data, total, q);
    }
    // Phiếu chưa thu là việc cần thao tác "Thu tiền": đứng trước dù là phiếu cũ
    const chuaThu: Prisma.PhieuPhatWhereInput = {
      AND: [where, { trangThai: TrangThaiPhieuPhat.CHUA_THANH_TOAN }],
    };
    const conLai: Prisma.PhieuPhatWhereInput = {
      AND: [where, { trangThai: { not: TrangThaiPhieuPhat.CHUA_THANH_TOAN } }],
    };
    const { data, total } = await pagePriorityFirst({
      ...skipTake(q),
      countFirst: () => this.prisma.phieuPhat.count({ where: chuaThu }),
      countRest: () => this.prisma.phieuPhat.count({ where: conLai }),
      findFirst: (skip, take) =>
        this.prisma.phieuPhat.findMany({
          where: chuaThu,
          include: INCLUDE,
          orderBy: MOI_NHAT_TRUOC,
          skip,
          take,
        }),
      findRest: (skip, take) =>
        this.prisma.phieuPhat.findMany({
          where: conLai,
          include: INCLUDE,
          orderBy: MOI_NHAT_TRUOC,
          skip,
          take,
        }),
    });
    return paginate(data, total, q);
  }

  async thanhToan(id: bigint) {
    await this.prisma.$executeRaw`CALL sp_thanh_toan_phat(${id})`;
    return this.prisma.phieuPhat.findUniqueOrThrow({ where: { id } });
  }

  /** Chỉ ADMIN (kiểm tra ở controller); procedure kiểm tra thêm điều kiện nghiệp vụ. */
  async huy(id: bigint, lyDo: string) {
    await this.prisma.$executeRaw`CALL sp_huy_phat(${id}, ${lyDo})`;
    return this.prisma.phieuPhat.findUniqueOrThrow({ where: { id } });
  }
}

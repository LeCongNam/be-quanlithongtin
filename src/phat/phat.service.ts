import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListPhatQueryDto } from './dto/phat.dto.js';

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
    const [data, total] = await Promise.all([
      this.prisma.phieuPhat.findMany({
        where,
        include: INCLUDE,
        orderBy: { id: 'desc' },
        ...skipTake(q),
      }),
      this.prisma.phieuPhat.count({ where }),
    ]);
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

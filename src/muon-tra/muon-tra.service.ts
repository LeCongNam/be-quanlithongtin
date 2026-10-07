import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isStaff } from '../common/auth-helpers.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import { withProcTransaction } from '../common/proc-transaction.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  GiaHanDto,
  ListPhieuMuonQueryDto,
  TaoPhieuMuonDto,
  TraSachDto,
} from './dto/muon-tra.dto.js';

const PHIEU_INCLUDE = {
  nguoiDung: { select: { maNguoiDung: true, hoTen: true } },
  nhanVien: { select: { maNguoiDung: true, hoTen: true } },
  ctPhieuMuons: {
    orderBy: { id: 'asc' },
    include: {
      banSach: {
        select: {
          maBanSach: true,
          sach: { select: { maSach: true, tenSach: true } },
        },
      },
      phieuPhats: true,
    },
  },
} satisfies Prisma.PhieuMuonInclude;

@Injectable()
export class MuonTraService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lập phiếu + thêm từng bản sách trong một transaction: một cuốn bị từ chối (hết hạn mức,
   * không sẵn sàng, ...) thì không để lại phiếu rỗng hay cuốn đã ghi trước đó. Luật mượn nằm trong procedure.
   */
  async taoPhieu(dto: TaoPhieuMuonDto, nhanVien: AuthUser) {
    const maPhieu = await withProcTransaction(this.prisma, async (tx) => {
      await tx.$executeRaw`CALL sp_tao_phieu_muon(${dto.maNguoiDung}, ${nhanVien.maNguoiDung}, @ma_phieu)`;
      const [{ ma_phieu }] = await tx.$queryRaw<
        { ma_phieu: string }[]
      >`SELECT @ma_phieu AS ma_phieu`;
      for (const maBanSach of dto.maBanSachs) {
        await tx.$executeRaw`CALL sp_them_sach_vao_phieu(${ma_phieu}, ${maBanSach})`;
      }
      return ma_phieu;
    });
    return this.findOne(maPhieu);
  }

  async list(q: ListPhieuMuonQueryDto) {
    const where: Prisma.PhieuMuonWhereInput = {
      trangThai: q.trangThai,
      nguoiDung: q.maNguoiDung ? { maNguoiDung: q.maNguoiDung } : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.phieuMuon.findMany({
        where,
        include: PHIEU_INCLUDE,
        // id không theo ngày nghiệp vụ (dữ liệu nhập bù/seed): xếp theo ngày mượn, id làm khóa phụ
        orderBy: [{ ngayMuon: 'desc' }, { id: 'desc' }],
        ...skipTake(q),
      }),
      this.prisma.phieuMuon.count({ where }),
    ]);
    return paginate(data, total, q);
  }

  async findOne(maPhieu: string, user?: AuthUser) {
    const phieu = await this.prisma.phieuMuon.findUnique({
      where: { maPhieu },
      include: PHIEU_INCLUDE,
    });
    if (!phieu) throw new NotFoundException('Khong tim thay phieu muon');
    if (
      user &&
      !isStaff(user) &&
      phieu.nguoiDung.maNguoiDung !== user.maNguoiDung
    ) {
      throw new ForbiddenException('Khong co quyen xem phieu muon nay');
    }
    return phieu;
  }

  async huyPhieu(maPhieu: string) {
    await this.prisma.$executeRaw`CALL sp_huy_phieu_muon(${maPhieu})`;
    return this.findOne(maPhieu);
  }

  async traSach({ maBanSach, tinhTrang }: TraSachDto) {
    await this.prisma.$executeRaw`CALL sp_tra_sach(${maBanSach}, ${tinhTrang})`;
    // Lượt mượn vừa đóng, kèm phiếu phạt (quá hạn/hư hỏng/mất) mà trigger/procedure đã sinh ra
    return this.prisma.ctPhieuMuon.findFirst({
      where: { banSach: { maBanSach }, ngayTra: { not: null } },
      orderBy: { id: 'desc' },
      include: { phieuPhats: true, phieuMuon: { select: { maPhieu: true } } },
    });
  }

  /**
   * Bạn đọc gia hạn qua sp_gia_han_luot_muon: điều kiện "lượt mượn thuộc người này" nằm ngay trong
   * SELECT ... FOR UPDATE của procedure; sách của người khác bị báo như không có lượt mượn (422).
   */
  async giaHan({ maBanSach, soNgay }: GiaHanDto, user: AuthUser) {
    if (isStaff(user)) {
      await this.prisma.$executeRaw`CALL sp_gia_han(${maBanSach}, ${soNgay})`;
    } else {
      await this.prisma
        .$executeRaw`CALL sp_gia_han_luot_muon(${maBanSach}, ${soNgay}, ${user.maNguoiDung})`;
    }
    return this.prisma.ctPhieuMuon.findFirst({
      where: { banSach: { maBanSach }, ngayTra: null },
      include: { phieuMuon: { select: { maPhieu: true } } },
    });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  namedRows,
  numberColumns,
  THEM_BAN_SACH_COLUMNS,
  TRA_CUU_SACH_COLUMNS,
} from '../common/call-rows.js';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { TinhTrangBanSach } from '../common/db-enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CapNhatTinhTrangBanSachDto,
  CreateBanSachDto,
  CreateSachDto,
  TraCuuSachQueryDto,
  UpdateSachDto,
} from './dto/sach.dto.js';

@Injectable()
export class SachService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Có từ khóa: gọi sp_tra_cuu_sach (ghi nhật ký tra cứu; % _ \ hiểu theo nghĩa đen). Không có (hoặc chỉ toàn
   * khoảng trắng, procedure sẽ trả tập rỗng): đọc vw_tra_cuu_sach có phân trang.
   */
  async traCuu(q: TraCuuSachQueryDto, user: AuthUser) {
    if (q.tuKhoa?.trim()) {
      const rows = await this.prisma.$queryRaw<
        Record<string, unknown>[]
      >`CALL sp_tra_cuu_sach(${q.tuKhoa}, ${user.maNguoiDung})`;
      const data = namedRows(rows, TRA_CUU_SACH_COLUMNS, [
        'nam_xuat_ban',
        'so_ban_san_sang',
      ]);
      return { data, total: data.length, page: 1, limit: data.length };
    }
    const { skip, take } = skipTake(q);
    const [rows, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<
        Record<string, unknown>[]
      >`SELECT * FROM vw_tra_cuu_sach ORDER BY ten_sach LIMIT ${take} OFFSET ${skip}`,
      this.prisma.$queryRaw<
        { total: bigint }[]
      >`SELECT COUNT(*) AS total FROM vw_tra_cuu_sach`,
    ]);
    return paginate(numberColumns(rows, ['so_ban_san_sang']), Number(total), q);
  }

  async findOne(id: bigint) {
    const sach = await this.prisma.sach.findUnique({
      where: { id },
      include: {
        theLoai: true,
        nhaXuatBan: true,
        sachTacGias: { include: { tacGia: true } },
      },
    });
    if (!sach) throw new NotFoundException('Khong tim thay sach');
    return sach;
  }

  /** Thêm đầu sách qua sp_them_sach: mã thể loại/NXB/tác giả sai thì không thêm gì (422). */
  async create(dto: CreateSachDto) {
    await this.prisma.$executeRaw`CALL sp_them_sach(
      ${dto.maSach}, ${dto.isbn ?? null}, ${dto.tenSach}, ${dto.maTheLoai}, ${dto.maNxb},
      ${dto.namXuatBan ?? null}, ${dto.ngonNgu ?? null}, ${dto.giaBia ?? null}, ${dto.moTa ?? null},
      ${(dto.maTacGias ?? []).join(',')})`;
    return this.prisma.sach.findUniqueOrThrow({
      where: { maSach: dto.maSach },
      include: { sachTacGias: { include: { tacGia: true } } },
    });
  }

  async update(id: bigint, dto: UpdateSachDto) {
    const { maTacGias, maTheLoai, maNxb, ...rest } = dto;
    const data: Prisma.SachUncheckedUpdateInput = { ...rest };
    if (maTheLoai !== undefined) {
      const tl = await this.prisma.theLoai.findUnique({ where: { maTheLoai } });
      if (!tl)
        throw new NotFoundException(`Khong tim thay the loai: ${maTheLoai}`);
      data.theLoaiId = tl.id;
    }
    if (maNxb !== undefined) {
      const nxb = await this.prisma.nhaXuatBan.findUnique({ where: { maNxb } });
      if (!nxb) throw new NotFoundException(`Khong tim thay NXB: ${maNxb}`);
      data.nxbId = nxb.id;
    }
    let tacGiaIds: bigint[] | undefined;
    if (maTacGias) {
      const tacGias = await this.prisma.tacGia.findMany({
        where: { maTacGia: { in: maTacGias } },
        select: { id: true, maTacGia: true },
      });
      const thieu = maTacGias.filter(
        (ma) => !tacGias.some((tg) => tg.maTacGia === ma),
      );
      if (thieu.length)
        throw new NotFoundException(
          `Khong tim thay tac gia: ${thieu.join(',')}`,
        );
      tacGiaIds = tacGias.map((tg) => tg.id);
    }

    return this.prisma.$transaction(async (tx) => {
      if (tacGiaIds) {
        await tx.sachTacGia.deleteMany({ where: { sachId: id } });
        await tx.sachTacGia.createMany({
          data: tacGiaIds.map((tacGiaId) => ({ sachId: id, tacGiaId })),
        });
      }
      return tx.sach.update({ where: { id }, data });
    });
  }

  remove(id: bigint) {
    return this.prisma.$transaction(async (tx) => {
      await tx.sachTacGia.deleteMany({ where: { sachId: id } });
      return tx.sach.delete({ where: { id } });
    });
  }

  // ---- Bản sách
  listBanSach(sachId: bigint) {
    return this.prisma.banSach.findMany({
      where: { sachId },
      orderBy: { maBanSach: 'asc' },
    });
  }

  /** Nhập bản sách qua sp_them_ban_sach (mã BSnnn tự sinh; bản mới tự được giữ nếu đầu sách có người chờ). */
  async createBanSach(sachId: bigint, { soBan, viTriKe }: CreateBanSachDto) {
    const { maSach } = await this.findOne(sachId);
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >`CALL sp_them_ban_sach(${maSach}, ${soBan}, ${viTriKe})`;
    return namedRows(rows, THEM_BAN_SACH_COLUMNS);
  }

  /** Đổi tình trạng qua sp_cap_nhat_tinh_trang_ban_sach (DB kiểm tra chuyển trạng thái hợp lệ). */
  async capNhatTinhTrang(
    maBanSach: string,
    { tinhTrang }: CapNhatTinhTrangBanSachDto,
  ) {
    if (
      !Object.values(TinhTrangBanSach).includes(tinhTrang as TinhTrangBanSach)
    ) {
      throw new BadRequestException('tinhTrang khong hop le');
    }
    await this.prisma
      .$executeRaw`CALL sp_cap_nhat_tinh_trang_ban_sach(${maBanSach}, ${tinhTrang})`;
    return this.prisma.banSach.findUniqueOrThrow({ where: { maBanSach } });
  }
}

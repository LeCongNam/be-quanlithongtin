import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { namedRows, TRA_CUU_SACH_COLUMNS } from '../common/call-rows.js';
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

  /** Có từ khóa: gọi sp_tra_cuu_sach (ghi nhật ký tra cứu). Không có: đọc vw_tra_cuu_sach có phân trang. */
  async traCuu(q: TraCuuSachQueryDto, user: AuthUser) {
    if (q.tuKhoa) {
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
    const [data, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<
        unknown[]
      >`SELECT * FROM vw_tra_cuu_sach ORDER BY ten_sach LIMIT ${take} OFFSET ${skip}`,
      this.prisma.$queryRaw<
        { total: bigint }[]
      >`SELECT COUNT(*) AS total FROM vw_tra_cuu_sach`,
    ]);
    return paginate(data, Number(total), q);
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

  create(dto: CreateSachDto) {
    const { tacGiaIds, theLoaiId, nxbId, ...rest } = dto;
    return this.prisma.sach.create({
      data: {
        ...rest,
        theLoaiId: BigInt(theLoaiId),
        nxbId: BigInt(nxbId),
        sachTacGias: {
          create: (tacGiaIds ?? []).map((id) => ({ tacGiaId: BigInt(id) })),
        },
      },
    });
  }

  async update(id: bigint, dto: UpdateSachDto) {
    const { tacGiaIds, theLoaiId, nxbId, ...rest } = dto;
    const data: Prisma.SachUncheckedUpdateInput = { ...rest };
    if (theLoaiId !== undefined) data.theLoaiId = BigInt(theLoaiId);
    if (nxbId !== undefined) data.nxbId = BigInt(nxbId);

    return this.prisma.$transaction(async (tx) => {
      if (tacGiaIds) {
        await tx.sachTacGia.deleteMany({ where: { sachId: id } });
        await tx.sachTacGia.createMany({
          data: tacGiaIds.map((tacGiaId) => ({
            sachId: id,
            tacGiaId: BigInt(tacGiaId),
          })),
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

  async createBanSach(sachId: bigint, dto: CreateBanSachDto) {
    const ngayNhap = new Date(dto.ngayNhap);
    if (Number.isNaN(ngayNhap.getTime()))
      throw new BadRequestException('ngayNhap khong hop le (yyyy-mm-dd)');
    return this.prisma.banSach.create({
      data: {
        sachId,
        maBanSach: dto.maBanSach,
        viTriKe: dto.viTriKe,
        ngayNhap,
      },
    });
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

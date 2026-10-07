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
import { parseSapXep, type SapXep } from '../common/dto/sap-xep.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { TinhTrangBanSach } from '../common/db-enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CapNhatTinhTrangBanSachDto,
  CreateBanSachDto,
  CreateSachDto,
  SACH_SAP_XEP,
  TimBanSachQueryDto,
  TraCuuSachQueryDto,
  UpdateSachDto,
} from './dto/sach.dto.js';

type CotSapXep = (typeof SACH_SAP_XEP)[number];

/** Field `sapXep` -> cột của `vw_tra_cuu_sach`; chỉ giá trị trong bảng này mới được nối vào câu SQL. */
const COT_SACH = {
  tenSach: 'ten_sach',
  maSach: 'ma_sach',
  namXuatBan: 'nam_xuat_ban',
  soBanSanSang: 'so_ban_san_sang',
} as const satisfies Record<CotSapXep, string>;

const COLLATOR_VI = new Intl.Collator('vi', { numeric: true });

/** Sort kết quả của sp_tra_cuu_sach (không phân trang): ô trống luôn cuối, hòa thì theo ma_sach. */
export function sortKetQuaTraCuu<T extends Record<string, unknown>>(
  rows: T[],
  { field, dir }: SapXep<CotSapXep>,
) {
  const cot = COT_SACH[field];
  const chieu = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[cot] as string | number | null;
    const y = b[cot] as string | number | null;
    if (x == null || y == null) {
      if (x == null && y == null) return 0;
      return x == null ? 1 : -1;
    }
    const cmp =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : COLLATOR_VI.compare(String(x), String(y));
    return (
      cmp * chieu || COLLATOR_VI.compare(String(a.ma_sach), String(b.ma_sach))
    );
  });
}

@Injectable()
export class SachService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Có từ khóa: gọi sp_tra_cuu_sach (ghi nhật ký tra cứu; % _ \ hiểu theo nghĩa đen). Không có (hoặc chỉ toàn
   * khoảng trắng, procedure sẽ trả tập rỗng): đọc vw_tra_cuu_sach có phân trang.
   */
  async traCuu(q: TraCuuSachQueryDto, user: AuthUser) {
    const sx = parseSapXep<CotSapXep>(q.sapXep);
    if (q.tuKhoa?.trim()) {
      const rows = await this.prisma.$queryRaw<
        Record<string, unknown>[]
      >`CALL sp_tra_cuu_sach(${q.tuKhoa}, ${user.maNguoiDung})`;
      const found = await this.kemId(
        namedRows(rows, TRA_CUU_SACH_COLUMNS, [
          'nam_xuat_ban',
          'so_ban_san_sang',
        ]),
      );
      const data = sx ? sortKetQuaTraCuu(found, sx) : found;
      return { data, total: data.length, page: 1, limit: data.length };
    }
    const { skip, take } = skipTake(q);
    // Chỉ nối vào SQL các chuỗi lấy từ COT_SACH (whitelist), không bao giờ chuỗi từ client
    const order = sx
      ? Prisma.raw(
          `${sx.field === 'namXuatBan' ? 'nam_xuat_ban IS NULL, ' : ''}${COT_SACH[sx.field]} ${sx.dir === 'desc' ? 'DESC' : 'ASC'}, ma_sach`,
        )
      : Prisma.raw('ten_sach, ma_sach');
    const [rows, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<
        Record<string, unknown>[]
      >`SELECT * FROM vw_tra_cuu_sach ORDER BY ${order} LIMIT ${take} OFFSET ${skip}`,
      this.prisma.$queryRaw<
        { total: bigint }[]
      >`SELECT COUNT(*) AS total FROM vw_tra_cuu_sach`,
    ]);
    const data = await this.kemId(numberColumns(rows, ['so_ban_san_sang']));
    return paginate(data, Number(total), q);
  }

  /** `vw_tra_cuu_sach` không có id; gắn `sach.id` theo `ma_sach` để FE gọi được /sach/{id}. */
  private async kemId<T extends Record<string, unknown>>(rows: T[]) {
    if (!rows.length) return [];
    const ids = await this.prisma.sach.findMany({
      where: { maSach: { in: rows.map((r) => String(r.ma_sach)) } },
      select: { id: true, maSach: true },
    });
    const idOf = new Map(ids.map((x) => [x.maSach, x.id.toString()]));
    return rows.map((r) => ({ ...r, id: idOf.get(String(r.ma_sach)) ?? '' }));
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
    if (!sach) throw new NotFoundException('Không tìm thấy sách');
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
        throw new NotFoundException(`Không tìm thấy thể loại: ${maTheLoai}`);
      data.theLoaiId = tl.id;
    }
    if (maNxb !== undefined) {
      const nxb = await this.prisma.nhaXuatBan.findUnique({ where: { maNxb } });
      if (!nxb) throw new NotFoundException(`Không tìm thấy NXB: ${maNxb}`);
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
          `Không tìm thấy tác giả: ${thieu.join(',')}`,
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
  /** Bản sách kèm tên sách/tác giả; truy vấn thẳng bảng nên không ghi nhật ký tra cứu như /sach?tuKhoa. */
  private static readonly BAN_KEM_SACH = {
    sach: {
      select: {
        maSach: true,
        tenSach: true,
        sachTacGias: { select: { tacGia: { select: { tenTacGia: true } } } },
      },
    },
  } satisfies Prisma.BanSachInclude;

  private static kemSach({
    sach: { sachTacGias, ...sach },
    ...ban
  }: Prisma.BanSachGetPayload<{ include: typeof SachService.BAN_KEM_SACH }>) {
    const tacGia = sachTacGias.map((x) => x.tacGia.tenTacGia).join(', ');
    return { ...ban, ...sach, tacGia: tacGia || null };
  }

  async timBanSach({ tuKhoa, tinhTrang, limit }: TimBanSachQueryDto) {
    const rows = await this.prisma.banSach.findMany({
      where: {
        ...(tinhTrang?.length && { tinhTrang: { in: tinhTrang } }),
        ...(tuKhoa && {
          OR: [
            { maBanSach: { contains: tuKhoa } },
            { sach: { tenSach: { contains: tuKhoa } } },
          ],
        }),
      },
      include: SachService.BAN_KEM_SACH,
      orderBy: [{ sach: { tenSach: 'asc' } }, { maBanSach: 'asc' }],
      take: limit,
    });
    return rows.map((r) => SachService.kemSach(r));
  }

  async findBanSach(maBanSach: string) {
    const ban = await this.prisma.banSach.findUnique({
      where: { maBanSach },
      include: SachService.BAN_KEM_SACH,
    });
    if (!ban) throw new NotFoundException('Không tìm thấy bản sách');
    return SachService.kemSach(ban);
  }

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
      throw new BadRequestException('tinhTrang không hợp lệ');
    }
    await this.prisma
      .$executeRaw`CALL sp_cap_nhat_tinh_trang_ban_sach(${maBanSach}, ${tinhTrang})`;
    return this.prisma.banSach.findUniqueOrThrow({ where: { maBanSach } });
  }
}

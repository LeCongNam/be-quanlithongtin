import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { numberColumns } from '../common/call-rows.js';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import { parseSapXep, type SapXep } from '../common/dto/sap-xep.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { TinhTrangBanSach } from '../common/db-enums.js';
import {
  DbService,
  type Row,
  type SqlExecutor,
} from '../database/db.service.js';
import { RecordNotFoundError } from '../database/db-error.js';
import { camelize, camelizeAll, updateTable } from '../database/rows.js';
import {
  ESCAPE_LIKE,
  likeContains,
  raw,
  sql,
  where,
  type SqlFragment,
} from '../database/sql.js';
import {
  CapNhatTinhTrangBanSachDto,
  CreateBanSachDto,
  CreateSachDto,
  SACH_SAP_XEP,
  TimBanSachQueryDto,
  TraCuuSachQueryDto,
  UpdateSachDto,
} from './dto/sach.dto.js';

const SACH_COLUMNS = [
  'maSach',
  'isbn',
  'tenSach',
  'theLoaiId',
  'nxbId',
  'namXuatBan',
  'ngonNgu',
  'giaBia',
  'moTa',
] as const;

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
  constructor(private readonly db: DbService) {}

  /**
   * Có từ khóa: gọi sp_tra_cuu_sach (ghi nhật ký tra cứu; % _ \ hiểu theo nghĩa đen). Không có (hoặc chỉ toàn
   * khoảng trắng, procedure sẽ trả tập rỗng): đọc vw_tra_cuu_sach có phân trang.
   */
  async traCuu(q: TraCuuSachQueryDto, user: AuthUser) {
    const sx = parseSapXep<CotSapXep>(q.sapXep);
    if (q.tuKhoa?.trim()) {
      const rows = await this.db.call('sp_tra_cuu_sach', [
        q.tuKhoa,
        user.maNguoiDung,
      ]);
      const found = await this.kemId(
        numberColumns(rows, ['nam_xuat_ban', 'so_ban_san_sang']),
      );
      const data = sx ? sortKetQuaTraCuu(found, sx) : found;
      return { data, total: data.length, page: 1, limit: data.length };
    }
    const { skip, take } = skipTake(q);
    // Chỉ nối vào SQL các chuỗi lấy từ COT_SACH (whitelist), không bao giờ chuỗi từ client
    const order = sx
      ? raw(
          `${sx.field === 'namXuatBan' ? 'nam_xuat_ban IS NULL, ' : ''}${COT_SACH[sx.field]} ${sx.dir === 'desc' ? 'DESC' : 'ASC'}, ma_sach`,
        )
      : raw('ten_sach, ma_sach');
    const [rows, [{ total }]] = await Promise.all([
      this.db.query(
        sql`SELECT * FROM vw_tra_cuu_sach ORDER BY ${order} LIMIT ${take} OFFSET ${skip}`,
      ),
      this.db.query<{ total: string }>(
        'SELECT COUNT(*) AS total FROM vw_tra_cuu_sach',
      ),
    ]);
    const data = await this.kemId(numberColumns(rows, ['so_ban_san_sang']));
    return paginate(data, Number(total), q);
  }

  /** `vw_tra_cuu_sach` không có id; gắn `sach.id` theo `ma_sach` để FE gọi được /sach/{id}. */
  private async kemId<T extends Row>(rows: T[]) {
    if (!rows.length) return [];
    const ids = await this.db.query<{ id: string; ma_sach: string }>(
      'SELECT id, ma_sach FROM sach WHERE ma_sach IN (?)',
      [rows.map((r) => String(r.ma_sach))],
    );
    const idOf = new Map(ids.map((x) => [x.ma_sach, x.id]));
    return rows.map((r) => ({ ...r, id: idOf.get(String(r.ma_sach)) ?? '' }));
  }

  async findOne(id: bigint) {
    const row = await this.db.queryOne('SELECT * FROM sach WHERE id = ?', [id]);
    if (!row) throw new NotFoundException('Không tìm thấy sách');
    const [theLoai, nhaXuatBan, sachTacGias] = await Promise.all([
      this.db.queryOne('SELECT * FROM the_loai WHERE id = ?', [
        row.the_loai_id,
      ]),
      this.db.queryOne('SELECT * FROM nha_xuat_ban WHERE id = ?', [row.nxb_id]),
      this.layTacGias([id]),
    ]);
    return {
      ...camelize<{ maSach: string }>(row),
      theLoai: theLoai && camelize(theLoai),
      nhaXuatBan: nhaXuatBan && camelize(nhaXuatBan),
      sachTacGias: sachTacGias.get(String(id)) ?? [],
    };
  }

  /** `sach_tac_gia` kèm tác giả, gom theo `sach_id` (thứ tự theo `tac_gia_id`). */
  private async layTacGias(
    sachIds: (bigint | string)[],
    db: SqlExecutor = this.db,
  ) {
    const rows = await db.query(
      `SELECT stg.sach_id, stg.tac_gia_id, tg.*
       FROM sach_tac_gia stg
       JOIN tac_gia tg ON tg.id = stg.tac_gia_id
       WHERE stg.sach_id IN (?)
       ORDER BY stg.sach_id, stg.tac_gia_id`,
      [sachIds],
    );
    const theoSach = new Map<string, Row[]>();
    for (const { sach_id, tac_gia_id, ...tacGia } of rows) {
      const list = theoSach.get(String(sach_id)) ?? [];
      list.push({
        sachId: sach_id,
        tacGiaId: tac_gia_id,
        tacGia: camelize(tacGia),
      });
      theoSach.set(String(sach_id), list);
    }
    return theoSach;
  }

  /** Thêm đầu sách qua sp_them_sach: mã thể loại/NXB/tác giả sai thì không thêm gì (422). */
  async create(dto: CreateSachDto) {
    await this.db.call('sp_them_sach', [
      dto.maSach,
      dto.isbn ?? null,
      dto.tenSach,
      dto.maTheLoai,
      dto.maNxb,
      dto.namXuatBan ?? null,
      dto.ngonNgu ?? null,
      dto.giaBia ?? null,
      dto.moTa ?? null,
      (dto.maTacGias ?? []).join(','),
    ]);
    const row = await this.db.queryOne('SELECT * FROM sach WHERE ma_sach = ?', [
      dto.maSach,
    ]);
    if (!row) throw new RecordNotFoundError();
    const sachTacGias = await this.layTacGias([row.id as string]);
    return {
      ...camelize(row),
      sachTacGias: sachTacGias.get(String(row.id)) ?? [],
    };
  }

  async update(id: bigint, dto: UpdateSachDto) {
    const { maTacGias, maTheLoai, maNxb, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (maTheLoai !== undefined) {
      const tl = await this.db.queryOne<{ id: string }>(
        'SELECT id FROM the_loai WHERE ma_the_loai = ?',
        [maTheLoai],
      );
      if (!tl)
        throw new NotFoundException(`Không tìm thấy thể loại: ${maTheLoai}`);
      data.theLoaiId = tl.id;
    }
    if (maNxb !== undefined) {
      const nxb = await this.db.queryOne<{ id: string }>(
        'SELECT id FROM nha_xuat_ban WHERE ma_nxb = ?',
        [maNxb],
      );
      if (!nxb) throw new NotFoundException(`Không tìm thấy NXB: ${maNxb}`);
      data.nxbId = nxb.id;
    }
    let tacGiaIds: string[] | undefined;
    if (maTacGias) {
      const tacGias = maTacGias.length
        ? await this.db.query<{ id: string; ma_tac_gia: string }>(
            'SELECT id, ma_tac_gia FROM tac_gia WHERE ma_tac_gia IN (?)',
            [maTacGias],
          )
        : [];
      const thieu = maTacGias.filter(
        (ma) => !tacGias.some((tg) => tg.ma_tac_gia === ma),
      );
      if (thieu.length)
        throw new NotFoundException(
          `Không tìm thấy tác giả: ${thieu.join(',')}`,
        );
      tacGiaIds = tacGias.map((tg) => tg.id);
    }

    return this.db.transaction(async (tx) => {
      if (tacGiaIds) {
        await tx.execute('DELETE FROM sach_tac_gia WHERE sach_id = ?', [id]);
        if (tacGiaIds.length) {
          await tx.execute(
            `INSERT INTO sach_tac_gia (sach_id, tac_gia_id) VALUES ${tacGiaIds.map(() => '(?, ?)').join(', ')}`,
            tacGiaIds.flatMap((tacGiaId) => [id, tacGiaId]),
          );
        }
      }
      await tx.executeOne(
        updateTable('sach', SACH_COLUMNS, data, sql`id = ${id}`),
      );
      const row = await tx.queryOne('SELECT * FROM sach WHERE id = ?', [id]);
      return camelize(row as Row);
    });
  }

  remove(id: bigint) {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne('SELECT * FROM sach WHERE id = ?', [id]);
      if (!row) throw new RecordNotFoundError();
      await tx.execute('DELETE FROM sach_tac_gia WHERE sach_id = ?', [id]);
      await tx.executeOne('DELETE FROM sach WHERE id = ?', [id]);
      return camelize(row);
    });
  }

  // ---- Bản sách
  /** Bản sách kèm tên sách/tác giả; truy vấn thẳng bảng nên không ghi nhật ký tra cứu như /sach?tuKhoa. */
  private static readonly SELECT_BAN_KEM_SACH = `
    SELECT bs.id, bs.ma_ban_sach, bs.sach_id, bs.vi_tri_ke, bs.ngay_nhap, bs.tinh_trang,
           s.ma_sach, s.ten_sach
    FROM ban_sach bs
    JOIN sach s ON s.id = bs.sach_id`;

  /** Gắn `tacGia` (tên các tác giả nối bằng ", ", hoặc null) vào các dòng của SELECT_BAN_KEM_SACH. */
  private async kemSach(rows: Row[]) {
    if (!rows.length) return [];
    const tacGias = await this.db.query<{
      sach_id: string;
      ten_tac_gia: string;
    }>(
      `SELECT stg.sach_id, tg.ten_tac_gia
       FROM sach_tac_gia stg
       JOIN tac_gia tg ON tg.id = stg.tac_gia_id
       WHERE stg.sach_id IN (?)
       ORDER BY stg.sach_id, stg.tac_gia_id`,
      [[...new Set(rows.map((r) => r.sach_id as string))]],
    );
    const tenTheoSach = new Map<string, string[]>();
    for (const { sach_id, ten_tac_gia } of tacGias) {
      tenTheoSach.set(sach_id, [
        ...(tenTheoSach.get(sach_id) ?? []),
        ten_tac_gia,
      ]);
    }
    return rows.map(({ ma_sach, ten_sach, ...ban }) => ({
      ...camelize(ban),
      maSach: ma_sach,
      tenSach: ten_sach,
      tacGia: tenTheoSach.get(String(ban.sach_id))?.join(', ') || null,
    }));
  }

  async timBanSach({ tuKhoa, tinhTrang, limit }: TimBanSachQueryDto) {
    const conds: SqlFragment[] = [];
    if (tinhTrang?.length) conds.push(sql`bs.tinh_trang IN (${tinhTrang})`);
    if (tuKhoa) {
      const mau = likeContains(tuKhoa);
      conds.push(
        sql`(bs.ma_ban_sach LIKE ${mau} ${ESCAPE_LIKE} OR s.ten_sach LIKE ${mau} ${ESCAPE_LIKE})`,
      );
    }
    const rows = await this.db.query(
      sql`${raw(SachService.SELECT_BAN_KEM_SACH)} ${where(conds)}
          ORDER BY s.ten_sach ASC, bs.ma_ban_sach ASC LIMIT ${limit}`,
    );
    return this.kemSach(rows);
  }

  async findBanSach(maBanSach: string) {
    const rows = await this.db.query(
      sql`${raw(SachService.SELECT_BAN_KEM_SACH)} WHERE bs.ma_ban_sach = ${maBanSach}`,
    );
    if (!rows.length) throw new NotFoundException('Không tìm thấy bản sách');
    return (await this.kemSach(rows))[0];
  }

  async listBanSach(sachId: bigint) {
    const rows = await this.db.query(
      'SELECT * FROM ban_sach WHERE sach_id = ? ORDER BY ma_ban_sach ASC',
      [sachId],
    );
    return camelizeAll(rows);
  }

  /** Nhập bản sách qua sp_them_ban_sach (mã BSnnn tự sinh; bản mới tự được giữ nếu đầu sách có người chờ). */
  async createBanSach(sachId: bigint, { soBan, viTriKe }: CreateBanSachDto) {
    const { maSach } = await this.findOne(sachId);
    return this.db.call('sp_them_ban_sach', [maSach, soBan, viTriKe]);
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
    await this.db.call('sp_cap_nhat_tinh_trang_ban_sach', [
      maBanSach,
      tinhTrang,
    ]);
    const row = await this.db.queryOne(
      'SELECT * FROM ban_sach WHERE ma_ban_sach = ?',
      [maBanSach],
    );
    if (!row) throw new RecordNotFoundError();
    return camelize(row);
  }
}

import { Injectable } from '@nestjs/common';
import { isStaff, resolveMaNguoiDung } from '../common/auth-helpers.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import { TrangThaiDatTruoc } from '../common/db-enums.js';
import { parseSapXep } from '../common/dto/sap-xep.js';
import { DbService, type Row } from '../database/db.service.js';
import { camelize } from '../database/rows.js';
import { raw, sql, where, type SqlFragment } from '../database/sql.js';
import {
  DAT_TRUOC_SAP_XEP,
  TaoDatTruocDto,
  ListDatTruocQueryDto,
} from './dto/dat-truoc.dto.js';

const SELECT_DAT_TRUOC = `
  SELECT dt.id, dt.nguoi_dung_id, dt.sach_id, dt.ban_sach_id, dt.ngay_dat, dt.han_giu, dt.trang_thai,
         dt.khoa_dang_hoat_dong, dt.ban_sach_dang_giu,
         s.ma_sach, s.ten_sach, nd.ma_nguoi_dung, nd.ho_ten
  FROM dat_truoc dt
  JOIN sach s ON s.id = dt.sach_id
  JOIN nguoi_dung nd ON nd.id = dt.nguoi_dung_id`;

/** Field `sapXep` (whitelist ở DTO) -> cột của dat_truoc. */
const CUOT_SAP_XEP: Record<(typeof DAT_TRUOC_SAP_XEP)[number], string> = {
  ngayDat: 'dt.ngay_dat',
  hanGiu: 'dt.han_giu',
};

/** Lượt còn hiệu lực (đang chờ / sẵn sàng nhận): đứng trước các lượt đã đóng, giống `/me/dat-truoc`. */
const DANG_CHO = [TrangThaiDatTruoc.CHO_XU_LY, TrangThaiDatTruoc.SAN_SANG_NHAN];

/** Dòng phẳng (JOIN) -> dạng lồng như response trước đây (model + quan hệ lồng nhau). */
function toDatTruoc(row: Row) {
  const { ma_sach, ten_sach, ma_nguoi_dung, ho_ten, ...datTruoc } = row;
  return {
    ...camelize(datTruoc),
    sach: { maSach: ma_sach, tenSach: ten_sach },
    nguoiDung: { maNguoiDung: ma_nguoi_dung, hoTen: ho_ten },
  };
}

@Injectable()
export class DatTruocService {
  constructor(private readonly db: DbService) {}

  async datTruoc(dto: TaoDatTruocDto, user: AuthUser) {
    const maNguoiDung = resolveMaNguoiDung(user, dto.maNguoiDung);
    await this.db.call('sp_dat_truoc', [maNguoiDung, dto.maSach]);
    const row = await this.db.queryOne(
      sql`${raw(SELECT_DAT_TRUOC)}
          WHERE s.ma_sach = ${dto.maSach} AND nd.ma_nguoi_dung = ${maNguoiDung}
          ORDER BY dt.id DESC LIMIT 1`,
    );
    return row ? toDatTruoc(row) : null;
  }

  async huyDatTruoc(
    maSach: string,
    user: AuthUser,
    maNguoiDungYeuCau?: string,
  ) {
    const maNguoiDung = resolveMaNguoiDung(user, maNguoiDungYeuCau);
    await this.db.call('sp_huy_dat_truoc', [maNguoiDung, maSach]);
    return { maSach, maNguoiDung, trangThai: 'HUY' };
  }

  async list(q: ListDatTruocQueryDto, user: AuthUser) {
    const conds: SqlFragment[] = [];
    if (q.trangThai) conds.push(sql`dt.trang_thai = ${q.trangThai}`);
    // Bạn đọc luôn bị giới hạn vào đặt trước của chính mình
    if (!isStaff(user)) {
      conds.push(sql`nd.ma_nguoi_dung = ${user.maNguoiDung}`);
    } else if (q.maNguoiDung) {
      conds.push(sql`nd.ma_nguoi_dung = ${q.maNguoiDung}`);
    }

    const sx = parseSapXep<(typeof DAT_TRUOC_SAP_XEP)[number]>(q.sapXep);
    // Người dùng chọn cột: sort thuần theo cột, không ưu tiên nhóm; hạn giữ trống (NULL) luôn cuối
    const dir = sx?.dir === 'asc' ? 'ASC' : 'DESC';
    const orderBy = sx
      ? raw(
          `${sx.field === 'hanGiu' ? 'dt.han_giu IS NULL, ' : ''}${CUOT_SAP_XEP[sx.field]} ${dir}, dt.id ${dir}`,
        )
      : sql`(dt.trang_thai IN (${DANG_CHO})) DESC, dt.ngay_dat DESC, dt.id DESC`;
    const { skip, take } = skipTake(q);

    const [rows, [count]] = await Promise.all([
      this.db.query(
        sql`${raw(SELECT_DAT_TRUOC)} ${where(conds)} ORDER BY ${orderBy} LIMIT ${take} OFFSET ${skip}`,
      ),
      this.db.query<{ total: string }>(
        sql`SELECT COUNT(*) AS total
            FROM dat_truoc dt
            JOIN nguoi_dung nd ON nd.id = dt.nguoi_dung_id
            ${where(conds)}`,
      ),
    ]);
    return paginate(rows.map(toDatTruoc), Number(count.total), q);
  }
}

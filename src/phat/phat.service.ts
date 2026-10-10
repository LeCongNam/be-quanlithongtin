import { Injectable } from '@nestjs/common';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import { TrangThaiPhieuPhat } from '../common/db-enums.js';
import { parseSapXep } from '../common/dto/sap-xep.js';
import { DbService, type Row } from '../database/db.service.js';
import { RecordNotFoundError } from '../database/db-error.js';
import { camelize } from '../database/rows.js';
import { raw, sql, where, type SqlFragment } from '../database/sql.js';
import { ListPhatQueryDto, PHAT_SAP_XEP } from './dto/phat.dto.js';

/** Field `sapXep` (whitelist ở DTO) -> cột của phieu_phat. */
const CUOT_SAP_XEP: Record<(typeof PHAT_SAP_XEP)[number], string> = {
  ngayTao: 'pp.ngay_tao',
  soTien: 'pp.so_tien',
};

const SELECT_PHIEU_PHAT = `
  SELECT pp.id, pp.ct_phieu_muon_id, pp.loai_phat, pp.so_tien, pp.ly_do, pp.trang_thai,
         pp.ngay_tao, pp.ngay_thanh_toan,
         bs.ma_ban_sach, s.ten_sach, pm.ma_phieu, nd.ma_nguoi_dung, nd.ho_ten
  FROM phieu_phat pp
  JOIN ct_phieu_muon ct ON ct.id = pp.ct_phieu_muon_id
  JOIN ban_sach bs ON bs.id = ct.ban_sach_id
  JOIN sach s ON s.id = bs.sach_id
  JOIN phieu_muon pm ON pm.id = ct.phieu_muon_id
  JOIN nguoi_dung nd ON nd.id = pm.nguoi_dung_id`;

/** Dòng phẳng (JOIN) -> dạng lồng như response trước đây (model + quan hệ lồng nhau). */
function toPhieuPhat(row: Row) {
  const {
    ma_ban_sach,
    ten_sach,
    ma_phieu,
    ma_nguoi_dung,
    ho_ten,
    ...phieuPhat
  } = row;
  return {
    ...camelize(phieuPhat),
    ctPhieuMuon: {
      banSach: { maBanSach: ma_ban_sach, sach: { tenSach: ten_sach } },
      phieuMuon: {
        maPhieu: ma_phieu,
        nguoiDung: { maNguoiDung: ma_nguoi_dung, hoTen: ho_ten },
      },
    },
  };
}

@Injectable()
export class PhatService {
  constructor(private readonly db: DbService) {}

  async list(q: ListPhatQueryDto) {
    const conds: SqlFragment[] = [];
    if (q.trangThai) conds.push(sql`pp.trang_thai = ${q.trangThai}`);
    if (q.maNguoiDung) conds.push(sql`nd.ma_nguoi_dung = ${q.maNguoiDung}`);

    const sx = parseSapXep<(typeof PHAT_SAP_XEP)[number]>(q.sapXep);
    // Người dùng chọn cột: sort thuần theo cột, không ưu tiên nhóm.
    // Mặc định: phiếu chưa thu là việc cần thao tác "Thu tiền" nên đứng trước dù là phiếu cũ.
    const orderBy = sx
      ? raw(
          `${CUOT_SAP_XEP[sx.field]} ${sx.dir === 'asc' ? 'ASC' : 'DESC'}, pp.id ${sx.dir === 'asc' ? 'ASC' : 'DESC'}`,
        )
      : sql`(pp.trang_thai = ${TrangThaiPhieuPhat.CHUA_THANH_TOAN}) DESC, pp.ngay_tao DESC, pp.id DESC`;
    const { skip, take } = skipTake(q);

    const [rows, [count]] = await Promise.all([
      this.db.query(
        sql`${raw(SELECT_PHIEU_PHAT)} ${where(conds)} ORDER BY ${orderBy} LIMIT ${take} OFFSET ${skip}`,
      ),
      this.db.query<{ total: string }>(
        sql`SELECT COUNT(*) AS total
            FROM phieu_phat pp
            JOIN ct_phieu_muon ct ON ct.id = pp.ct_phieu_muon_id
            JOIN phieu_muon pm ON pm.id = ct.phieu_muon_id
            JOIN nguoi_dung nd ON nd.id = pm.nguoi_dung_id
            ${where(conds)}`,
      ),
    ]);
    return paginate(rows.map(toPhieuPhat), Number(count.total), q);
  }

  async thanhToan(id: bigint) {
    await this.db.call('sp_thanh_toan_phat', [id]);
    return this.layPhieuPhat(id);
  }

  /** Chỉ ADMIN (kiểm tra ở controller); procedure kiểm tra thêm điều kiện nghiệp vụ. */
  async huy(id: bigint, lyDo: string) {
    await this.db.call('sp_huy_phat', [id, lyDo]);
    return this.layPhieuPhat(id);
  }

  private async layPhieuPhat(id: bigint) {
    const row = await this.db.queryOne(
      'SELECT * FROM phieu_phat WHERE id = ?',
      [id],
    );
    if (!row) throw new RecordNotFoundError();
    return camelize(row);
  }
}

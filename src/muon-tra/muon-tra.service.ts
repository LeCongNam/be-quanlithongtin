import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isStaff } from '../common/auth-helpers.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import { DbService, type Row } from '../database/db.service.js';
import { camelize, groupBy } from '../database/rows.js';
import { raw, sql, where, type SqlFragment } from '../database/sql.js';
import {
  GiaHanDto,
  ListPhieuMuonQueryDto,
  PHIEU_MUON_SAP_XEP,
  TaoPhieuMuonDto,
  TraSachDto,
} from './dto/muon-tra.dto.js';
import { parseSapXep } from '../common/dto/sap-xep.js';

/** Field `sapXep` (whitelist ở DTO) -> cột của phieu_muon. */
const CUOT_SAP_XEP: Record<(typeof PHIEU_MUON_SAP_XEP)[number], string> = {
  ngayMuon: 'pm.ngay_muon',
  maPhieu: 'pm.ma_phieu',
};

const SELECT_PHIEU = `
  SELECT pm.id, pm.ma_phieu, pm.nguoi_dung_id, pm.nhan_vien_id, pm.ngay_muon, pm.trang_thai,
         nd.ma_nguoi_dung AS nd_ma_nguoi_dung, nd.ho_ten AS nd_ho_ten,
         nv.ma_nguoi_dung AS nv_ma_nguoi_dung, nv.ho_ten AS nv_ho_ten
  FROM phieu_muon pm
  JOIN nguoi_dung nd ON nd.id = pm.nguoi_dung_id
  JOIN nguoi_dung nv ON nv.id = pm.nhan_vien_id`;

const SELECT_CT = `
  SELECT ct.*, bs.ma_ban_sach, s.ma_sach, s.ten_sach
  FROM ct_phieu_muon ct
  JOIN ban_sach bs ON bs.id = ct.ban_sach_id
  JOIN sach s ON s.id = bs.sach_id`;

@Injectable()
export class MuonTraService {
  constructor(private readonly db: DbService) {}

  /**
   * Lập phiếu + thêm từng bản sách trong một transaction: một cuốn bị từ chối (hết hạn mức,
   * không sẵn sàng, ...) thì không để lại phiếu rỗng hay cuốn đã ghi trước đó. Luật mượn nằm trong procedure.
   */
  async taoPhieu(dto: TaoPhieuMuonDto, nhanVien: AuthUser) {
    const maPhieu = await this.db.procTransaction(async (tx) => {
      await tx.execute('CALL sp_tao_phieu_muon(?, ?, @ma_phieu)', [
        dto.maNguoiDung,
        nhanVien.maNguoiDung,
      ]);
      const [{ ma_phieu }] = await tx.query<{ ma_phieu: string }>(
        'SELECT @ma_phieu AS ma_phieu',
      );
      for (const maBanSach of dto.maBanSachs) {
        await tx.call('sp_them_sach_vao_phieu', [ma_phieu, maBanSach]);
      }
      return ma_phieu;
    });
    return this.findOne(maPhieu);
  }

  async list(q: ListPhieuMuonQueryDto) {
    const sx = parseSapXep<(typeof PHIEU_MUON_SAP_XEP)[number]>(q.sapXep);
    const conds: SqlFragment[] = [];
    if (q.trangThai) conds.push(sql`pm.trang_thai = ${q.trangThai}`);
    if (q.maNguoiDung) conds.push(sql`nd.ma_nguoi_dung = ${q.maNguoiDung}`);
    const dir = sx?.dir === 'asc' ? 'ASC' : 'DESC';
    // id không theo ngày nghiệp vụ (dữ liệu nhập bù/seed): xếp theo ngày mượn, id làm khóa phụ
    const orderBy = raw(
      sx
        ? `${CUOT_SAP_XEP[sx.field]} ${dir}, pm.id ${dir}`
        : 'pm.ngay_muon DESC, pm.id DESC',
    );
    const { skip, take } = skipTake(q);

    const [rows, [count]] = await Promise.all([
      this.db.query(
        sql`${raw(SELECT_PHIEU)} ${where(conds)} ORDER BY ${orderBy} LIMIT ${take} OFFSET ${skip}`,
      ),
      this.db.query<{ total: string }>(
        sql`SELECT COUNT(*) AS total
            FROM phieu_muon pm
            JOIN nguoi_dung nd ON nd.id = pm.nguoi_dung_id
            ${where(conds)}`,
      ),
    ]);
    return paginate(await this.ghepChiTiet(rows), Number(count.total), q);
  }

  async findOne(maPhieu: string, user?: AuthUser) {
    const rows = await this.db.query(
      sql`${raw(SELECT_PHIEU)} WHERE pm.ma_phieu = ${maPhieu}`,
    );
    if (!rows.length) throw new NotFoundException('Không tìm thấy phiếu mượn');
    const [phieu] = await this.ghepChiTiet(rows);
    if (
      user &&
      !isStaff(user) &&
      phieu.nguoiDung.maNguoiDung !== user.maNguoiDung
    ) {
      throw new ForbiddenException('Không có quyền xem phiếu mượn này');
    }
    return phieu;
  }

  /**
   * Dòng phiếu (đã JOIN người mượn/nhân viên) -> dạng lồng như response trước đây (model + quan hệ lồng nhau):
   * `nguoiDung`, `nhanVien`, `ctPhieuMuons[]` (mỗi dòng kèm `banSach.sach` và `phieuPhats[]`).
   */
  private async ghepChiTiet(phieus: Row[]) {
    if (!phieus.length) return [];
    const ids = phieus.map((p) => p.id as string);
    const cts = await this.db.query(
      sql`${raw(SELECT_CT)} WHERE ct.phieu_muon_id IN (${ids}) ORDER BY ct.id`,
    );
    const phats = cts.length
      ? await this.db.query(
          'SELECT * FROM phieu_phat WHERE ct_phieu_muon_id IN (?) ORDER BY ct_phieu_muon_id, id',
          [cts.map((c) => c.id as string)],
        )
      : [];

    const phatTheoCt = groupBy(phats, (p) => p.ct_phieu_muon_id);
    const ctTheoPhieu = groupBy(cts, (c) => c.phieu_muon_id);
    return phieus.map((p) => {
      const {
        nd_ma_nguoi_dung,
        nd_ho_ten,
        nv_ma_nguoi_dung,
        nv_ho_ten,
        ...phieu
      } = p;
      return {
        ...camelize<{ id: string }>(phieu),
        nguoiDung: { maNguoiDung: nd_ma_nguoi_dung, hoTen: nd_ho_ten },
        nhanVien: { maNguoiDung: nv_ma_nguoi_dung, hoTen: nv_ho_ten },
        ctPhieuMuons: (ctTheoPhieu.get(String(p.id)) ?? []).map(
          ({ ma_ban_sach, ma_sach, ten_sach, ...ct }) => ({
            ...camelize(ct),
            banSach: {
              maBanSach: ma_ban_sach,
              sach: { maSach: ma_sach, tenSach: ten_sach },
            },
            phieuPhats: (phatTheoCt.get(String(ct.id)) ?? []).map((x) =>
              camelize(x),
            ),
          }),
        ),
      };
    }) as (ReturnType<typeof camelize<{ id: string }>> & {
      nguoiDung: { maNguoiDung: string; hoTen: string };
    })[];
  }

  async huyPhieu(maPhieu: string) {
    await this.db.call('sp_huy_phieu_muon', [maPhieu]);
    return this.findOne(maPhieu);
  }

  async traSach({ maBanSach, tinhTrang }: TraSachDto) {
    await this.db.call('sp_tra_sach', [maBanSach, tinhTrang]);
    // Lượt mượn vừa đóng, kèm phiếu phạt (quá hạn/hư hỏng/mất) mà trigger/procedure đã sinh ra
    const ct = await this.layLuotMuon(
      maBanSach,
      sql`ct.ngay_tra IS NOT NULL`,
      'DESC',
    );
    if (!ct) return null;
    const phats = await this.db.query(
      'SELECT * FROM phieu_phat WHERE ct_phieu_muon_id = ? ORDER BY id',
      [ct.id],
    );
    return {
      ...ct.data,
      phieuPhats: phats.map((x) => camelize(x)),
      phieuMuon: ct.phieuMuon,
    };
  }

  /**
   * Bạn đọc gia hạn qua sp_gia_han_luot_muon: điều kiện "lượt mượn thuộc người này" nằm ngay trong
   * SELECT ... FOR UPDATE của procedure; sách của người khác bị báo như không có lượt mượn (422).
   */
  async giaHan({ maBanSach, soNgay }: GiaHanDto, user: AuthUser) {
    if (isStaff(user)) {
      await this.db.call('sp_gia_han', [maBanSach, soNgay]);
    } else {
      await this.db.call('sp_gia_han_luot_muon', [
        maBanSach,
        soNgay,
        user.maNguoiDung,
      ]);
    }
    const ct = await this.layLuotMuon(
      maBanSach,
      sql`ct.ngay_tra IS NULL`,
      'ASC',
    );
    return ct && { ...ct.data, phieuMuon: ct.phieuMuon };
  }

  /** Một lượt mượn của bản sách theo điều kiện: các cột của `ct_phieu_muon` + `phieuMuon: { maPhieu }`. */
  private async layLuotMuon(
    maBanSach: string,
    cond: SqlFragment,
    thuTu: 'ASC' | 'DESC',
  ) {
    const row = await this.db.queryOne(
      sql`SELECT ct.* , pm.ma_phieu
          FROM ct_phieu_muon ct
          JOIN ban_sach bs ON bs.id = ct.ban_sach_id
          JOIN phieu_muon pm ON pm.id = ct.phieu_muon_id
          WHERE bs.ma_ban_sach = ${maBanSach} AND ${cond}
          ORDER BY ct.id ${raw(thuTu)} LIMIT 1`,
    );
    if (!row) return null;
    const { ma_phieu, ...ct } = row;
    return {
      id: ct.id as string,
      data: camelize(ct),
      phieuMuon: { maPhieu: ma_phieu },
    };
  }
}

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hashMatKhau } from '../common/password.js';
import { paginate, skipTake } from '../common/dto/page-query.dto.js';
import {
  LoaiNguoiDung,
  TrangThaiNguoiDung,
  TrangThaiTaiKhoan,
  VaiTroTaiKhoan,
} from '../common/db-enums.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { DbService, type SqlExecutor } from '../database/db.service.js';
import {
  camelize,
  camelizeAll,
  insertInto,
  updateTable,
} from '../database/rows.js';
import {
  ESCAPE_LIKE,
  likeContains,
  raw,
  sql,
  where,
  type SqlFragment,
} from '../database/sql.js';
import { CreateDocgiaDto } from './dto/create-docgia.dto.js';
import { CreateTaiKhoanDto } from './dto/create-tai-khoan.dto.js';
import { DOCGIA_SAP_XEP, ListDocgiaQueryDto } from './dto/docgia-query.dto.js';
import { UpdateDocgiaDto } from './dto/update-docgia.dto.js';
import { parseSapXep } from '../common/dto/sap-xep.js';

const NGUOI_DUNG_COLUMNS = [
  'maNguoiDung',
  'hoTen',
  'loaiNguoiDung',
  'email',
  'sdt',
  'khoaDonVi',
] as const;

/** Field `sapXep` (whitelist ở DTO) -> cột của nguoi_dung. */
const CUOT_SAP_XEP: Record<(typeof DOCGIA_SAP_XEP)[number], string> = {
  maNguoiDung: 'ma_nguoi_dung',
  hoTen: 'ho_ten',
};

// Không bao giờ trả mat_khau_hash / muoi ra ngoài.
const TAI_KHOAN_PUBLIC = 'ten_dang_nhap, vai_tro, trang_thai';

@Injectable()
export class DocgiaService {
  constructor(private readonly db: DbService) {}

  create(dto: CreateDocgiaDto) {
    return this.db.transaction(async (tx) => {
      const { insertId } = await tx.execute(
        insertInto('nguoi_dung', NGUOI_DUNG_COLUMNS, {
          maNguoiDung: dto.maNguoiDung,
          hoTen: dto.hoTen,
          loaiNguoiDung: dto.loaiNguoiDung,
          email: dto.email?.trim() || null,
          sdt: dto.sdt?.trim() || null,
          khoaDonVi: dto.khoaDonVi?.trim() || null,
        }),
      );
      return this.layNguoiDung(BigInt(insertId), tx);
    });
  }

  async findAll(q: ListDocgiaQueryDto) {
    const sx = parseSapXep<(typeof DOCGIA_SAP_XEP)[number]>(q.sapXep);
    const conds: SqlFragment[] = [];
    if (q.loaiNguoiDung) conds.push(sql`loai_nguoi_dung = ${q.loaiNguoiDung}`);
    if (q.trangThai) conds.push(sql`trang_thai = ${q.trangThai}`);
    if (q.tuKhoa) {
      const mau = likeContains(q.tuKhoa);
      conds.push(
        sql`(ma_nguoi_dung LIKE ${mau} ${ESCAPE_LIKE} OR ho_ten LIKE ${mau} ${ESCAPE_LIKE} OR email LIKE ${mau} ${ESCAPE_LIKE})`,
      );
    }
    const dir = sx?.dir === 'desc' ? 'DESC' : 'ASC';
    const orderBy = sx
      ? `${CUOT_SAP_XEP[sx.field]} ${dir}, id ${dir}`
      : 'ma_nguoi_dung ASC';
    const { skip, take } = skipTake(q);

    const [rows, [count]] = await Promise.all([
      this.db.query(
        sql`SELECT * FROM nguoi_dung ${where(conds)} ORDER BY ${raw(orderBy)} LIMIT ${take} OFFSET ${skip}`,
      ),
      this.db.query<{ total: string }>(
        sql`SELECT COUNT(*) AS total FROM nguoi_dung ${where(conds)}`,
      ),
    ]);
    return paginate(camelizeAll(rows), Number(count.total), q);
  }

  async findOne(id: bigint) {
    const docgia = await this.layNguoiDung(id);
    if (!docgia) throw new NotFoundException('Không tìm thấy người dùng');
    const taiKhoan = await this.db.queryOne(
      `SELECT ${TAI_KHOAN_PUBLIC} FROM tai_khoan WHERE nguoi_dung_id = ?`,
      [id],
    );
    return { ...docgia, taiKhoan: taiKhoan ? camelize(taiKhoan) : null };
  }

  update(id: bigint, dto: UpdateDocgiaDto) {
    return this.db.transaction(async (tx) => {
      await tx.executeOne(
        updateTable(
          'nguoi_dung',
          NGUOI_DUNG_COLUMNS,
          {
            maNguoiDung: dto.maNguoiDung,
            hoTen: dto.hoTen,
            loaiNguoiDung: dto.loaiNguoiDung,
            email:
              dto.email === undefined ? undefined : dto.email.trim() || null,
            sdt: dto.sdt,
            khoaDonVi: dto.khoaDonVi,
          },
          sql`id = ${id}`,
        ),
      );
      return this.layNguoiDung(id, tx);
    });
  }

  /**
   * Bạn đọc: qua sp_doi_trang_thai_nguoi_dung (ghi nhật ký DOI_TRANG_THAI_ND). Cán bộ: procedure từ chối,
   * chỉ quản trị đổi trực tiếp. Khi người dùng rời HOAT_DONG, trg_nguoi_dung_au tự khóa tài khoản;
   * quay lại HOAT_DONG thì tài khoản vẫn KHOA, quản trị phải mở riêng (doiTrangThaiTaiKhoan).
   */
  async doiTrangThai(
    id: bigint,
    trangThai: TrangThaiNguoiDung,
    user: AuthUser,
  ) {
    const nd = await this.findOne(id);
    if (nd.loaiNguoiDung === LoaiNguoiDung.CAN_BO) {
      if (user.vaiTro !== VaiTroTaiKhoan.ADMIN)
        throw new ForbiddenException(
          'Chỉ quản trị viên được đổi trạng thái cán bộ',
        );
      await this.db.executeOne(
        'UPDATE nguoi_dung SET trang_thai = ? WHERE id = ?',
        [trangThai, id],
      );
    } else {
      await this.db.call('sp_doi_trang_thai_nguoi_dung', [
        nd.maNguoiDung,
        trangThai,
      ]);
    }
    return this.findOne(id);
  }

  /** Không xóa cứng (còn phiếu mượn/phạt tham chiếu): chuyển sang NGUNG, trigger khóa tài khoản theo. */
  remove(id: bigint, user: AuthUser) {
    return this.doiTrangThai(id, TrangThaiNguoiDung.NGUNG, user);
  }

  /** Chỉ quản trị. trg_tai_khoan_bu từ chối mở tài khoản khi người dùng chưa HOAT_DONG (422). */
  async doiTrangThaiTaiKhoan(id: bigint, trangThai: TrangThaiTaiKhoan) {
    return this.db.transaction(async (tx) => {
      const taiKhoan = await tx.queryOne(
        'SELECT id FROM tai_khoan WHERE nguoi_dung_id = ?',
        [id],
      );
      if (!taiKhoan)
        throw new NotFoundException('Người dùng chưa có tài khoản');
      await tx.executeOne(
        'UPDATE tai_khoan SET trang_thai = ? WHERE nguoi_dung_id = ?',
        [trangThai, id],
      );
      return this.layTaiKhoanPublic(id, tx);
    });
  }

  async taoTaiKhoan(id: bigint, dto: CreateTaiKhoanDto) {
    const nguoiDung = await this.layNguoiDung(id);
    if (!nguoiDung) throw new NotFoundException('Không tìm thấy người dùng');
    const daCo = await this.db.queryOne(
      'SELECT id FROM tai_khoan WHERE nguoi_dung_id = ?',
      [id],
    );
    if (daCo) throw new ConflictException('Người dùng đã có tài khoản');

    const vaiTro =
      dto.vaiTro ??
      (nguoiDung.loaiNguoiDung === LoaiNguoiDung.CAN_BO
        ? VaiTroTaiKhoan.THU_THU
        : VaiTroTaiKhoan.BAN_DOC);

    const muoi = randomBytes(16).toString('hex');
    return this.db.transaction(async (tx) => {
      await tx.execute(
        insertInto(
          'tai_khoan',
          [
            'nguoiDungId',
            'tenDangNhap',
            'muoi',
            'matKhauHash',
            'vaiTro',
            'trangThai',
          ],
          {
            nguoiDungId: id,
            tenDangNhap: dto.tenDangNhap ?? nguoiDung.maNguoiDung.toLowerCase(),
            muoi,
            matKhauHash: hashMatKhau(muoi, dto.matKhau),
            vaiTro,
            trangThai: TrangThaiTaiKhoan.HOAT_DONG,
          },
        ),
      );
      return this.layTaiKhoanPublic(id, tx);
    });
  }

  private async layNguoiDung(id: bigint, db: SqlExecutor = this.db) {
    const row = await db.queryOne('SELECT * FROM nguoi_dung WHERE id = ?', [
      id,
    ]);
    return row && camelize<{ loaiNguoiDung: string; maNguoiDung: string }>(row);
  }

  private async layTaiKhoanPublic(nguoiDungId: bigint, db: SqlExecutor) {
    const row = await db.queryOne(
      `SELECT ${TAI_KHOAN_PUBLIC} FROM tai_khoan WHERE nguoi_dung_id = ?`,
      [nguoiDungId],
    );
    return row && camelize(row);
  }
}

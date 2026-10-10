import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService, type SqlExecutor } from '../database/db.service.js';
import {
  camelize,
  camelizeAll,
  insertInto,
  updateTable,
} from '../database/rows.js';
import { raw, sql } from '../database/sql.js';
import {
  PageQueryDto,
  paginate,
  skipTake,
} from '../common/dto/page-query.dto.js';
import { CreateTheLoaiDto, UpdateTheLoaiDto } from './dto/the-loai.dto.js';
import {
  CreateNhaXuatBanDto,
  UpdateNhaXuatBanDto,
} from './dto/nha-xuat-ban.dto.js';
import { CreateTacGiaDto, UpdateTacGiaDto } from './dto/tac-gia.dto.js';

/** Một bảng danh mục: tên bảng, thứ tự mặc định và các cột ghi được (camelCase, khớp DTO). */
interface DanhMuc {
  table: string;
  order: string;
  columns: readonly string[];
  /** Dùng trong thông báo 404. */
  label: string;
}

const THE_LOAI: DanhMuc = {
  table: 'the_loai',
  order: 'ten_the_loai, id',
  columns: ['maTheLoai', 'tenTheLoai', 'moTa'],
  label: 'the loai',
};
const NHA_XUAT_BAN: DanhMuc = {
  table: 'nha_xuat_ban',
  order: 'ten_nxb, id',
  columns: ['maNxb', 'tenNxb', 'diaChi', 'email', 'sdt'],
  label: 'nha xuat ban',
};
const TAC_GIA: DanhMuc = {
  table: 'tac_gia',
  order: 'ten_tac_gia, id',
  columns: ['maTacGia', 'tenTacGia', 'quocTich', 'namSinh'],
  label: 'tac gia',
};

/** CRUD cho 3 danh mục: thể loại, nhà xuất bản, tác giả. Xóa bản ghi đang được sách dùng -> 409 (FK). */
@Injectable()
export class DanhMucService {
  constructor(private readonly db: DbService) {}

  // ---- Thể loại
  listTheLoai(q: PageQueryDto) {
    return this.list(THE_LOAI, q);
  }
  getTheLoai(id: bigint) {
    return this.get(THE_LOAI, id);
  }
  createTheLoai(data: CreateTheLoaiDto) {
    return this.create(THE_LOAI, data);
  }
  updateTheLoai(id: bigint, data: UpdateTheLoaiDto) {
    return this.update(THE_LOAI, id, data);
  }
  removeTheLoai(id: bigint) {
    return this.remove(THE_LOAI, id);
  }

  // ---- Nhà xuất bản
  listNhaXuatBan(q: PageQueryDto) {
    return this.list(NHA_XUAT_BAN, q);
  }
  getNhaXuatBan(id: bigint) {
    return this.get(NHA_XUAT_BAN, id);
  }
  createNhaXuatBan(data: CreateNhaXuatBanDto) {
    return this.create(NHA_XUAT_BAN, data);
  }
  updateNhaXuatBan(id: bigint, data: UpdateNhaXuatBanDto) {
    return this.update(NHA_XUAT_BAN, id, data);
  }
  removeNhaXuatBan(id: bigint) {
    return this.remove(NHA_XUAT_BAN, id);
  }

  // ---- Tác giả
  listTacGia(q: PageQueryDto) {
    return this.list(TAC_GIA, q);
  }
  getTacGia(id: bigint) {
    return this.get(TAC_GIA, id);
  }
  createTacGia(data: CreateTacGiaDto) {
    return this.create(TAC_GIA, data);
  }
  updateTacGia(id: bigint, data: UpdateTacGiaDto) {
    return this.update(TAC_GIA, id, data);
  }
  removeTacGia(id: bigint) {
    return this.remove(TAC_GIA, id);
  }

  // ---- Dùng chung (bảng/cột chỉ lấy từ hằng số DanhMuc phía trên)
  private async list(dm: DanhMuc, q: PageQueryDto) {
    const { skip, take } = skipTake(q);
    const [rows, [{ total }]] = await Promise.all([
      this.db.query(
        sql`SELECT * FROM ${raw(dm.table)} ORDER BY ${raw(dm.order)} LIMIT ${take} OFFSET ${skip}`,
      ),
      this.db.query<{ total: string }>(
        sql`SELECT COUNT(*) AS total FROM ${raw(dm.table)}`,
      ),
    ]);
    return paginate(camelizeAll(rows), Number(total), q);
  }

  private async find(dm: DanhMuc, id: bigint, db: SqlExecutor = this.db) {
    const row = await db.queryOne(
      sql`SELECT * FROM ${raw(dm.table)} WHERE id = ${id}`,
    );
    return row && camelize(row);
  }

  private async get(dm: DanhMuc, id: bigint, db: SqlExecutor = this.db) {
    const row = await this.find(dm, id, db);
    if (!row) throw new NotFoundException(`Không tìm thấy ${dm.label}`);
    return row;
  }

  private create(dm: DanhMuc, data: object) {
    return this.db.transaction(async (tx) => {
      const { insertId } = await tx.execute(
        insertInto(dm.table, dm.columns, data as Record<string, unknown>),
      );
      return this.get(dm, BigInt(insertId), tx);
    });
  }

  private update(dm: DanhMuc, id: bigint, data: object) {
    return this.db.transaction(async (tx) => {
      await tx.executeOne(
        updateTable(
          dm.table,
          dm.columns,
          data as Record<string, unknown>,
          sql`id = ${id}`,
        ),
      );
      return this.get(dm, id, tx);
    });
  }

  private async remove(dm: DanhMuc, id: bigint) {
    const row = await this.find(dm, id);
    await this.db.executeOne(
      sql`DELETE FROM ${raw(dm.table)} WHERE id = ${id}`,
    );
    return row;
  }
}

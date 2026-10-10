import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DbService,
  type Row,
  type SqlExecutor,
  type TypeCast,
} from '../database/db.service.js';
import {
  DatabaseError,
  mapDbError,
  RecordNotFoundError,
} from '../database/db-error.js';
import { DEMO_CATALOG, type MucDemo } from './demo.catalog.js';

type Values = Record<string, string | number | null>;

export interface BangKetQua {
  nhan: string;
  cot: string[];
  dong: Row[];
}

const THAM_SO = /:([a-z_]+)\b/g;

/**
 * Bảng demo hiển thị số là number (pool mặc định trả BIGINT/DECIMAL dạng chuỗi để JSON giống phần còn lại của API):
 * BIGINT vượt giới hạn an toàn của number vẫn giữ chuỗi.
 */
const SO_THANH_NUMBER: TypeCast = (field, next) => {
  if (
    field.type === 'LONGLONG' ||
    field.type === 'NEWDECIMAL' ||
    field.type === 'DECIMAL'
  ) {
    const value = field.string();
    if (value === null) return null;
    const n = Number(value);
    return field.type === 'LONGLONG' && !Number.isSafeInteger(n) ? value : n;
  }
  return next();
};

/** Thay `:ten` bằng `?` và trả danh sách giá trị theo thứ tự xuất hiện (bind an toàn, không nối chuỗi). */
function bind(sql: string, values: Values) {
  const args: (string | number | null)[] = [];
  const text = sql.replace(THAM_SO, (_, ten: string) => {
    if (!(ten in values)) {
      throw new BadRequestException(`Thiếu tham số ${ten}`);
    }
    args.push(values[ten]);
    return '?';
  });
  return { text, args };
}

/** Câu lệnh để hiển thị (B4): thay giá trị vào cho dễ đọc, không dùng để chạy. */
function hienThi(sql: string, values: Values) {
  return sql.replace(THAM_SO, (_, ten: string) => {
    const v = values[ten];
    if (v === null || v === undefined) return 'NULL';
    return typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`;
  });
}

function chuanHoaGiaTri(value: unknown): unknown {
  if (value instanceof Date) {
    const s = value.toISOString().slice(0, 19).replace('T', ' ');
    return s.endsWith(' 00:00:00') ? s.slice(0, 10) : s;
  }
  return value;
}

function thanhBang(nhan: string, rows: Row[], cot?: readonly string[]) {
  const dong = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, chuanHoaGiaTri(v)]),
    ),
  );
  return {
    nhan,
    cot: cot ? [...cot] : rows.length ? Object.keys(rows[0]) : [],
    dong,
  } satisfies BangKetQua;
}

/**
 * Module demo cho đề (xử lý thông tin: Procedure, Trigger, Function, Cursor). Mọi dữ liệu trình bày đều đọc từ CSDL
 * lúc gọi: câu SQL của routine (SHOW CREATE), các bảng liên quan trước/sau, output; BE chỉ giữ catalog mô tả bài
 * toán/tham số. `chay` mặc định hoàn tác (ROLLBACK) để demo lặp lại được mà không đổi dữ liệu.
 */
@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(private readonly db: DbService) {}

  list() {
    return DEMO_CATALOG.map((m) => ({
      id: m.id,
      loai: m.loai,
      tieuDe: m.tieuDe,
      baiToan: m.baiToan,
      doiTuong: m.doiTuong,
    }));
  }

  async chiTiet(id: string) {
    const item = this.tim(id);
    const [dinhNghia, thamSo] = await Promise.all([
      Promise.all(item.doiTuong.map((ten) => this.docDinhNghia(ten))),
      Promise.all(
        item.thamSo.map(async (p) => ({
          ten: p.ten,
          nhan: p.nhan,
          kieu: p.kieu,
          macDinh: p.macDinh ?? null,
          tuyChon: p.tuyChon ?? false,
          goiY: p.goiY ? await this.docGoiY(p.goiY) : [],
        })),
      ),
    ]);
    return {
      id: item.id,
      loai: item.loai,
      tieuDe: item.tieuDe,
      baiToan: item.baiToan,
      doiTuong: item.doiTuong,
      dinhNghia,
      thamSo,
      tinhHuong: item.tinhHuong ?? [],
      lenh: item.lenh,
      bang: item.bang.map((b) => b.nhan),
    };
  }

  /** Bước 3: các bảng liên quan trước khi chạy. */
  async bang(id: string, thamSo: Record<string, string>) {
    const item = this.tim(id);
    const values = this.chuanHoa(item, thamSo);
    return { bang: await this.docBang(this.db, item, values) };
  }

  /** Bước 4 và 5: chạy rồi đọc lại các bảng liên quan. */
  async chay(id: string, thamSo: Record<string, string>, hoanTac: boolean) {
    const item = this.tim(id);
    const values = this.chuanHoa(item, thamSo);
    const lenh = hienThi(item.lenh, values);

    // autocommit = 0: procedure chạy trong transaction của session này (không tự COMMIT) nên ROLLBACK hoàn tác được;
    // `session` tự trả autocommit = 1 trước khi nhả connection về pool.
    return this.db.session(async (conn) => {
      await conn.execute('SET autocommit = 0');
      let loi: string | null = null;
      let soDongAnhHuong: number | null = null;
      let ketQua: BangKetQua | null = null;
      try {
        const out = await this.thucThi(conn, item, values);
        soDongAnhHuong = out.soDongAnhHuong;
        ketQua = out.ketQua;
      } catch (err) {
        loi = this.thongBaoLoi(err);
        await conn.execute('ROLLBACK');
      }
      const bangSau = await this.docBang(conn, item, values);
      const daHoanTac = loi !== null || hoanTac;
      await conn.execute(daHoanTac ? 'ROLLBACK' : 'COMMIT');
      return {
        lenh,
        thanhCong: loi === null,
        loi,
        daHoanTac,
        soDongAnhHuong,
        ketQua,
        bangSau,
      };
    });
  }

  private tim(id: string): MucDemo {
    const item = DEMO_CATALOG.find((m) => m.id === id);
    if (!item) throw new NotFoundException('Không tìm thấy mục demo');
    return item;
  }

  private chuanHoa(item: MucDemo, input: Record<string, string>): Values {
    const values: Values = {};
    for (const p of item.thamSo) {
      const raw = input?.[p.ten];
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text === '') {
        if (!p.tuyChon) {
          throw new BadRequestException(`Thiếu tham số ${p.nhan}`);
        }
        values[p.ten] = null;
      } else if (p.kieu === 'number') {
        const n = Number(text);
        if (!Number.isFinite(n)) {
          throw new BadRequestException(`${p.nhan} phải là số`);
        }
        values[p.ten] = n;
      } else if (p.kieu === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          throw new BadRequestException(`${p.nhan} phải có dạng YYYY-MM-DD`);
        }
        values[p.ten] = text;
      } else {
        if (text.length > 255) {
          throw new BadRequestException(`${p.nhan} qua dai`);
        }
        values[p.ten] = text;
      }
    }
    return values;
  }

  private async thucThi(
    conn: SqlExecutor,
    item: MucDemo,
    values: Values,
  ): Promise<{ soDongAnhHuong: number | null; ketQua: BangKetQua | null }> {
    const { text, args } = bind(item.lenh, values);
    switch (item.chay) {
      case 'CALL':
        await conn.execute(text, args);
        return { soDongAnhHuong: null, ketQua: null };
      case 'DML': {
        const { affectedRows } = await conn.execute(text, args);
        return { soDongAnhHuong: affectedRows, ketQua: null };
      }
      case 'CALL_KQ': {
        // CALL trả [result set đầu, ..., header]; procedure không SELECT gì thì chỉ có header
        const result: unknown = await conn.query(text, args, SO_THANH_NUMBER);
        const rows = (
          Array.isArray(result) && Array.isArray(result[0]) ? result[0] : []
        ) as Row[];
        return {
          soDongAnhHuong: null,
          ketQua: thanhBang('Kết quả trả về', rows, item.cot),
        };
      }
      case 'SELECT': {
        const rows = await conn.query(text, args, SO_THANH_NUMBER);
        return {
          soDongAnhHuong: null,
          ketQua: thanhBang('Kết quả trả về', rows),
        };
      }
    }
  }

  private async docBang(db: SqlExecutor, item: MucDemo, values: Values) {
    const out: BangKetQua[] = [];
    for (const b of item.bang) {
      const { text, args } = bind(b.sql, values);
      const rows = await db.query(text, args, SO_THANH_NUMBER);
      out.push(thanhBang(b.nhan, rows));
    }
    return out;
  }

  private async docGoiY(sql: string) {
    const rows = await this.db.query(sql);
    return rows.map((r) => ({
      giaTri: String(chuanHoaGiaTri(r.gia_tri)),
      moTa: typeof r.mo_ta === 'string' ? r.mo_ta : null,
    }));
  }

  /**
   * Câu SQL của routine/trigger. Ưu tiên `SHOW CREATE` từ CSDL; user `qltt` chỉ có SELECT/INSERT/UPDATE/DELETE/EXECUTE
   * (cố ý, quyền tối thiểu) nên CSDL trả NULL (và trigger cần quyền TRIGGER), khi đó lấy đúng đoạn CREATE trong
   * các file `sql/0x_*.sql` là nguồn đã nạp vào CSDL.
   */
  private async docDinhNghia(ten: string) {
    const trigger = ten.startsWith('trg_');
    if (!trigger) {
      const kind = ten.startsWith('fn_') ? 'FUNCTION' : 'PROCEDURE';
      try {
        const rows = await this.db.query(`SHOW CREATE ${kind} \`${ten}\``);
        const sql =
          rows[0]?.[`Create ${kind === 'FUNCTION' ? 'Function' : 'Procedure'}`];
        if (typeof sql === 'string') {
          return {
            ten,
            sql: sql.replace(/DEFINER=`[^`]*`@`[^`]*` /, ''),
            nguon: 'CSDL',
          };
        }
      } catch (err) {
        this.logger.warn(`SHOW CREATE ${ten} loi: ${String(err)}`);
      }
    }
    return { ten, sql: await this.docTuTepSql(ten), nguon: 'TEP_SQL' };
  }

  private async docTuTepSql(ten: string) {
    const tep = ten.startsWith('trg_')
      ? '05_triggers.sql'
      : ten.startsWith('fn_')
        ? '03_functions.sql'
        : ten.startsWith('sp_cursor_')
          ? '06_cursors.sql'
          : '04_procedures.sql';
    try {
      const noiDung = await readFile(join(process.cwd(), 'sql', tep), 'utf8');
      const m = new RegExp(
        `CREATE (?:PROCEDURE|FUNCTION|TRIGGER) ${ten}\\b[\\s\\S]*?END\\$\\$`,
      ).exec(noiDung);
      return m ? m[0].replace(/\$\$$/, ';') : null;
    } catch (err) {
      this.logger.warn(`Khong doc duoc sql/${tep}: ${String(err)}`);
      return null;
    }
  }

  private thongBaoLoi(err: unknown) {
    if (err instanceof DatabaseError || err instanceof RecordNotFoundError) {
      return mapDbError(err).message;
    }
    this.logger.error(String(err));
    return 'Loi khong xac dinh';
  }
}

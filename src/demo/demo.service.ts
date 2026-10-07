import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { namedRows } from '../common/call-rows.js';
import { DatabaseExceptionFilter } from '../common/filters/database-exception.filter.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEMO_CATALOG, type MucDemo } from './demo.catalog.js';

type Values = Record<string, string | number | null>;
type Row = Record<string, unknown>;
type Db = Pick<PrismaService, '$queryRawUnsafe' | '$executeRawUnsafe'>;

export interface BangKetQua {
  nhan: string;
  cot: string[];
  dong: Row[];
}

const THAM_SO = /:([a-z_]+)\b/g;
const dbFilter = new DatabaseExceptionFilter();

/** Thay `:ten` bằng `?` và trả danh sách giá trị theo thứ tự xuất hiện (bind an toàn, không nối chuỗi). */
function bind(sql: string, values: Values) {
  const args: (string | number | null)[] = [];
  const text = sql.replace(THAM_SO, (_, ten: string) => {
    if (!(ten in values)) {
      throw new BadRequestException(`Thieu tham so ${ten}`);
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
  if (typeof value === 'bigint') {
    return Number.isSafeInteger(Number(value)) ? Number(value) : String(value);
  }
  if (value instanceof Date) {
    const s = value.toISOString().slice(0, 19).replace('T', ' ');
    return s.endsWith(' 00:00:00') ? s.slice(0, 10) : s;
  }
  if (value instanceof Prisma.Decimal) return value.toNumber();
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

  constructor(private readonly prisma: PrismaService) {}

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
    return { bang: await this.docBang(this.prisma, item, values) };
  }

  /** Bước 4 và 5: chạy rồi đọc lại các bảng liên quan. */
  async chay(id: string, thamSo: Record<string, string>, hoanTac: boolean) {
    const item = this.tim(id);
    const values = this.chuanHoa(item, thamSo);
    const lenh = hienThi(item.lenh, values);

    return this.prisma.$transaction(
      async (tx) => {
        // autocommit = 0: procedure chạy trong transaction này (không tự COMMIT) nên ROLLBACK hoàn tác được.
        await tx.$executeRawUnsafe('SET autocommit = 0');
        try {
          let loi: string | null = null;
          let soDongAnhHuong: number | null = null;
          let ketQua: BangKetQua | null = null;
          try {
            const out = await this.thucThi(tx, item, values);
            soDongAnhHuong = out.soDongAnhHuong;
            ketQua = out.ketQua;
          } catch (err) {
            loi = this.thongBaoLoi(err);
            await tx.$executeRawUnsafe('ROLLBACK');
          }
          const bangSau = await this.docBang(tx, item, values);
          const daHoanTac = loi !== null || hoanTac;
          await tx.$executeRawUnsafe(daHoanTac ? 'ROLLBACK' : 'COMMIT');
          return {
            lenh,
            thanhCong: loi === null,
            loi,
            daHoanTac,
            soDongAnhHuong,
            ketQua,
            bangSau,
          };
        } finally {
          await tx.$executeRawUnsafe('SET autocommit = 1');
        }
      },
      { timeout: 20000 },
    );
  }

  private tim(id: string): MucDemo {
    const item = DEMO_CATALOG.find((m) => m.id === id);
    if (!item) throw new NotFoundException('Khong tim thay muc demo');
    return item;
  }

  private chuanHoa(item: MucDemo, input: Record<string, string>): Values {
    const values: Values = {};
    for (const p of item.thamSo) {
      const raw = input?.[p.ten];
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text === '') {
        if (!p.tuyChon) {
          throw new BadRequestException(`Thieu tham so ${p.nhan}`);
        }
        values[p.ten] = null;
      } else if (p.kieu === 'number') {
        const n = Number(text);
        if (!Number.isFinite(n)) {
          throw new BadRequestException(`${p.nhan} phai la so`);
        }
        values[p.ten] = n;
      } else if (p.kieu === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          throw new BadRequestException(`${p.nhan} phai co dang YYYY-MM-DD`);
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
    tx: Db,
    item: MucDemo,
    values: Values,
  ): Promise<{ soDongAnhHuong: number | null; ketQua: BangKetQua | null }> {
    const { text, args } = bind(item.lenh, values);
    switch (item.chay) {
      case 'CALL':
        await tx.$executeRawUnsafe(text, ...args);
        return { soDongAnhHuong: null, ketQua: null };
      case 'DML': {
        const n = await tx.$executeRawUnsafe(text, ...args);
        return { soDongAnhHuong: n, ketQua: null };
      }
      case 'CALL_KQ': {
        const rows = await tx.$queryRawUnsafe<Row[]>(text, ...args);
        const named = namedRows(rows, item.cot ?? [], item.cotSo ?? []);
        return {
          soDongAnhHuong: null,
          ketQua: thanhBang('Kết quả trả về', named, item.cot),
        };
      }
      case 'SELECT': {
        const rows = await tx.$queryRawUnsafe<Row[]>(text, ...args);
        return { soDongAnhHuong: null, ketQua: thanhBang('Kết quả trả về', rows) };
      }
    }
  }

  private async docBang(db: Db, item: MucDemo, values: Values) {
    const out: BangKetQua[] = [];
    for (const b of item.bang) {
      const { text, args } = bind(b.sql, values);
      const rows = await db.$queryRawUnsafe<Row[]>(text, ...args);
      out.push(thanhBang(b.nhan, rows));
    }
    return out;
  }

  private async docGoiY(sql: string) {
    const rows = await this.prisma.$queryRawUnsafe<Row[]>(sql);
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
        const rows = await this.prisma.$queryRawUnsafe<Row[]>(
          `SHOW CREATE ${kind} \`${ten}\``,
        );
        const sql = rows[0]?.[`Create ${kind === 'FUNCTION' ? 'Function' : 'Procedure'}`];
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
    if (
      err instanceof Prisma.PrismaClientKnownRequestError ||
      err instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return dbFilter.map(err).message;
    }
    this.logger.error(String(err));
    return 'Loi khong xac dinh';
  }
}

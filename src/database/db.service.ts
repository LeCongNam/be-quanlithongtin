import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mysql, {
  type Pool,
  type PoolOptions,
  type PoolConnection,
  type ResultSetHeader,
} from 'mysql2/promise';
import { parseDatabaseUrl } from './db-config.js';
import { DatabaseError, RecordNotFoundError } from './db-error.js';
import { toStatement, type Query } from './sql.js';

export type Row = Record<string, unknown>;

/** Hàm đổi kiểu cột theo từng truy vấn, ghi đè `typeCast` của pool (xem `db-config.ts`). */
export type TypeCast = Exclude<PoolOptions['typeCast'], boolean | undefined>;

/** `query` của mysql2 (pool hoặc connection): kết quả là `[rows | ResultSetHeader | nhiều result set, fields]`. */
interface Queryable {
  query(
    sql: string | { sql: string; values: unknown[]; typeCast: TypeCast },
    values?: unknown[],
  ): Promise<[unknown, unknown]>;
}

/**
 * Chạy SQL trên một pool hoặc một connection cố định (trong transaction). Mọi lỗi từ driver được bọc thành
 * `DatabaseError` để `DatabaseExceptionFilter` đổi sang mã HTTP.
 *
 * Dùng `query` (bind `?` ở phía client) thay vì `execute` vì `execute` (prepared statement) hay lỗi với
 * `LIMIT ? OFFSET ?` trên MySQL 8 và không mở rộng được `IN (?)`.
 */
export class SqlExecutor {
  constructor(private readonly target: Queryable) {}

  private async run(
    query: Query,
    params?: unknown[],
    typeCast?: TypeCast,
  ): Promise<unknown> {
    const [text, values] = toStatement(query, params);
    try {
      const [result] = typeCast
        ? await this.target.query({ sql: text, values, typeCast })
        : await this.target.query(text, values);
      return result;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /** SELECT: mọi dòng. */
  async query<T extends Row = Row>(
    query: Query,
    params?: unknown[],
    typeCast?: TypeCast,
  ): Promise<T[]> {
    return (await this.run(query, params, typeCast)) as T[];
  }

  /** SELECT: dòng đầu tiên hoặc `undefined`. */
  async queryOne<T extends Row = Row>(
    query: Query,
    params?: unknown[],
  ): Promise<T | undefined> {
    return (await this.query<T>(query, params))[0];
  }

  /** INSERT/UPDATE/DELETE/`CALL` không cần result set: trả `affectedRows`, `insertId`... */
  async execute(query: Query, params?: unknown[]): Promise<ResultSetHeader> {
    const result = await this.run(query, params);
    // CALL có SELECT bên trong trả [rows, header]; lấy header cuối cho nhất quán
    return (
      Array.isArray(result) ? result[result.length - 1] : result
    ) as ResultSetHeader;
  }

  /** UPDATE/DELETE theo khóa: không có dòng nào khớp thì ném 404 (thay cho P2025 của Prisma). */
  async executeOne(query: Query, params?: unknown[]): Promise<ResultSetHeader> {
    const result = await this.execute(query, params);
    if (result.affectedRows === 0) throw new RecordNotFoundError();
    return result;
  }

  /**
   * `CALL sp_...(?, ?)` và trả result set đầu tiên (tên cột giữ nguyên, khác `$queryRaw` của Prisma).
   * Procedure không SELECT gì thì trả mảng rỗng. `name` được ghép thẳng vào câu lệnh nên chỉ nhận `sp_*`.
   */
  async call<T extends Row = Row>(
    name: string,
    args: unknown[] = [],
    typeCast?: TypeCast,
  ): Promise<T[]> {
    if (!/^sp_[a-z0-9_]+$/.test(name)) {
      throw new Error(`Tên procedure không hợp lệ: ${name}`);
    }
    const result = await this.run(
      `CALL ${name}(${args.map(() => '?').join(', ')})`,
      args,
      typeCast,
    );
    return (
      Array.isArray(result) && Array.isArray(result[0]) ? result[0] : []
    ) as T[];
  }
}

@Injectable()
export class DbService
  extends SqlExecutor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DbService.name);
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const pool = mysql.createPool(
      parseDatabaseUrl(config.getOrThrow<string>('DATABASE_URL'), {
        sslCa: config.get<string>('DATABASE_SSL_CA'),
      }),
    );
    super(pool as unknown as Queryable);
    this.pool = pool;
  }

  async onModuleInit() {
    // Lỗi cấu hình/kết nối lộ ngay khi khởi động thay vì ở request đầu tiên
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /**
   * Giữ một connection cho `fn` (các câu lệnh dùng chung session: biến `@x`, `autocommit`). Trả `autocommit = 1`
   * trước khi nhả connection về pool; nếu không trả được thì hủy connection để pool không tái dùng nó.
   */
  async session<T>(fn: (conn: SqlExecutor) => Promise<T>): Promise<T> {
    const conn = await this.getConnection();
    try {
      return await fn(new SqlExecutor(conn as unknown as Queryable));
    } finally {
      await this.release(conn);
    }
  }

  /**
   * Transaction thường (`START TRANSACTION ... COMMIT`) cho nhiều câu DML. KHÔNG dùng để gộp các `CALL sp_*` ghi
   * dữ liệu: procedure tự `START TRANSACTION` nên ngầm COMMIT phần việc trước đó, dùng `procTransaction`.
   */
  async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const conn = await this.getConnection();
    try {
      try {
        await conn.beginTransaction();
      } catch (err) {
        throw new DatabaseError(err);
      }
      let result: T;
      try {
        result = await fn(new SqlExecutor(conn as unknown as Queryable));
      } catch (err) {
        await conn.rollback().catch(() => undefined);
        throw err;
      }
      try {
        await conn.commit();
      } catch (err) {
        throw new DatabaseError(err);
      }
      return result;
    } finally {
      await this.release(conn);
    }
  }

  /**
   * Gộp nhiều `CALL sp_*` thành một transaction (vd. lập phiếu + thêm từng bản sách).
   *
   * Procedure ghi dữ liệu tự `START TRANSACTION ... COMMIT` khi `@@autocommit = 1` (sql/04_procedures.sql, đầu file),
   * nên mỗi procedure tự commit riêng và lỗi ở bước sau không hoàn tác được bước trước. Với `autocommit = 0`
   * procedure chạy trong transaction của bên gọi, lỗi thì ROLLBACK cả transaction.
   */
  async procTransaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.session(async (conn) => {
      await conn.execute('SET autocommit = 0');
      try {
        const result = await fn(conn);
        await conn.execute('COMMIT');
        return result;
      } catch (err) {
        await conn.execute('ROLLBACK').catch(() => undefined);
        throw err;
      }
    });
  }

  private async getConnection(): Promise<PoolConnection> {
    try {
      return await this.pool.getConnection();
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /**
   * Trả connection về pool. Chuyển `autocommit` từ 0 sang 1 sẽ COMMIT transaction đang mở, nên phải ROLLBACK trước:
   * việc chưa được commit tường minh (callback ném lỗi, COMMIT thất bại...) không bao giờ được lưu.
   * Không dọn được thì hủy connection để pool không tái dùng nó.
   */
  private async release(conn: PoolConnection) {
    try {
      await conn.query('ROLLBACK');
      await conn.query('SET autocommit = 1');
      conn.release();
    } catch (err) {
      this.logger.warn(
        `Hủy connection không dọn được (ROLLBACK/autocommit): ${String(err)}`,
      );
      conn.destroy();
    }
  }
}

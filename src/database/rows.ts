import { join, raw, sql, SqlFragment } from './sql.js';

/** `ma_nguoi_dung` -> `maNguoiDung` */
export function toCamel(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** `maNguoiDung` -> `ma_nguoi_dung` */
export function toSnake(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Đổi khóa snake_case của dòng SELECT sang camelCase (giữ hình dạng JSON như model Prisma trước đây). */
export function camelize<T = Record<string, unknown>>(
  row: Record<string, unknown>,
): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [toCamel(key), value]),
  ) as T;
}

export function camelizeAll<T = Record<string, unknown>>(
  rows: Record<string, unknown>[],
): T[] {
  return rows.map((row) => camelize<T>(row));
}

/** Các cặp [cột snake_case, giá trị] của những field camelCase trong `columns` mà `data` có khai báo (khác `undefined`). */
function definedEntries(
  columns: readonly string[],
  data: Record<string, unknown>,
): [string, unknown][] {
  return columns
    .filter((name) => data[name] !== undefined)
    .map((name) => [toSnake(name), data[name]]);
}

/**
 * `INSERT INTO table (...) VALUES (...)` chỉ với các field có trong `columns` (whitelist, camelCase) và đã khai báo.
 * `null` được ghi thành NULL; field `undefined` bị bỏ qua để DB dùng giá trị mặc định.
 * `table` và `columns` là hằng số trong code, không phải dữ liệu từ client.
 */
export function insertInto(
  table: string,
  columns: readonly string[],
  data: Record<string, unknown>,
): SqlFragment {
  const entries = definedEntries(columns, data);
  if (!entries.length) return raw(`INSERT INTO ${table} () VALUES ()`);
  return sql`INSERT INTO ${raw(table)} (${raw(entries.map(([c]) => c).join(', '))})
    VALUES (${join(entries.map(([, v]) => sql`${v}`))})`;
}

/**
 * `UPDATE table SET ... WHERE <cond>`; chỉ cập nhật field đã khai báo (`undefined` = giữ nguyên, `null` = ghi NULL).
 * Không có field nào thì vẫn chạy `SET id = id` để câu lệnh khớp/không khớp dòng như một UPDATE bình thường.
 */
export function updateTable(
  table: string,
  columns: readonly string[],
  data: Record<string, unknown>,
  cond: SqlFragment,
  idColumn = 'id',
): SqlFragment {
  const entries = definedEntries(columns, data);
  const assignments = entries.length
    ? join(entries.map(([c, v]) => sql`${raw(c)} = ${v}`))
    : raw(`${idColumn} = ${idColumn}`);
  return sql`UPDATE ${raw(table)} SET ${assignments} WHERE ${cond}`;
}

/** Gom dòng theo khóa chuỗi (dùng để ghép dòng con vào dòng cha sau khi truy vấn riêng theo `IN (...)`). */
export function groupBy<T>(
  items: T[],
  key: (item: T) => unknown,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = String(key(item));
    const list = groups.get(k);
    if (list) list.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

/**
 * Ghép câu SQL động mà vẫn bind tham số: mỗi `${giá trị}` thành `?`, giá trị đi riêng trong `params`.
 * Chỉ `raw()` mới chèn thẳng chuỗi vào câu lệnh, và chỉ dùng cho tên cột/chiều sắp xếp lấy từ whitelist,
 * không bao giờ cho chuỗi từ client.
 *
 * Mảng được bind thành danh sách (`IN (${ids})` -> `IN (?)`); mảng rỗng sinh `IN ()` là lỗi cú pháp nên người gọi tự chặn.
 */
export class SqlFragment {
  constructor(
    readonly text: string,
    readonly params: unknown[] = [],
  ) {}
}

export type Query = string | SqlFragment;

export function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): SqlFragment {
  let text = strings[0];
  const params: unknown[] = [];
  values.forEach((value, i) => {
    if (value instanceof SqlFragment) {
      text += value.text;
      params.push(...value.params);
    } else {
      text += '?';
      params.push(value);
    }
    text += strings[i + 1];
  });
  return new SqlFragment(text, params);
}

/** Chèn nguyên văn vào câu SQL (không bind). Chỉ dùng cho chuỗi cố định hoặc lấy từ whitelist. */
export const raw = (text: string) => new SqlFragment(text);

export const empty = raw('');

export function join(fragments: SqlFragment[], separator = ', '): SqlFragment {
  return new SqlFragment(
    fragments.map((f) => f.text).join(separator),
    fragments.flatMap((f) => f.params),
  );
}

/** `WHERE a AND b ...`; rỗng nếu không có điều kiện. */
export function where(conds: SqlFragment[]): SqlFragment {
  return conds.length ? sql`WHERE ${join(conds, ' AND ')}` : empty;
}

/** Mệnh đề đi sau `LIKE ?` để dùng với `likeContains` (trong SQL là `ESCAPE '\\'`, một dấu `\`). */
export const ESCAPE_LIKE = raw("ESCAPE '\\\\'");

/** Mẫu cho `LIKE ... ESCAPE '\\'` để `% _ \` trong từ khóa được hiểu theo nghĩa đen. */
export function likeContains(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
}

/** Chuẩn hóa (query, params) hoặc SqlFragment về cặp [text, params] cho driver; `undefined` thành NULL. */
export function toStatement(
  query: Query,
  params: unknown[] = [],
): [string, unknown[]] {
  const [text, values] =
    query instanceof SqlFragment ? [query.text, query.params] : [query, params];
  return [text, values.map((v) => (v === undefined ? null : v))];
}

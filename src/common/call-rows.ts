/**
 * Ép các cột đếm/tổng của view/`CALL` (BIGINT và DECIMAL pool trả về dạng chuỗi) về number để mọi endpoint
 * trả cùng một kiểu (như /me/*). Chỉ dùng cho cột số đếm/tiền VND của view, không dùng cho khóa chính.
 */
export function numberColumns<T extends Record<string, unknown>>(
  rows: T[],
  columns: readonly string[],
): T[] {
  for (const row of rows) {
    for (const col of columns) {
      const value = row[col];
      if (value !== null && value !== undefined) {
        (row as Record<string, unknown>)[col] = Number(value);
      }
    }
  }
  return rows;
}

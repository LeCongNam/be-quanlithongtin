/**
 * `prisma.$queryRaw` với `CALL sp_...` mất tên cột và trả về f0, f1, ... (hạn chế của Prisma với
 * result set của procedure). Gán lại tên theo đúng thứ tự cột mà procedure SELECT ra.
 * Nếu đổi danh sách cột trong sql/04_procedures.sql thì phải cập nhật mảng cột tương ứng ở đây.
 */
export function namedRows<T extends string>(
  rows: Record<string, unknown>[],
  columns: readonly T[],
  numeric: readonly T[] = [],
): Record<T, unknown>[] {
  return rows.map((row) => {
    const out = {} as Record<T, unknown>;
    columns.forEach((name, i) => {
      const value = row[`f${i}`];
      out[name] =
        numeric.includes(name) && value !== null && value !== undefined
          ? Number(value)
          : value;
    });
    return out;
  });
}

// Cột trả về của các procedure có result set mà BE gọi (sql/04_procedures.sql)

/** sp_tra_cuu_sach: SELECT v.* FROM vw_tra_cuu_sach (sql/07_reports.sql) */
export const TRA_CUU_SACH_COLUMNS = [
  'ma_sach',
  'isbn',
  'ten_sach',
  'ds_tac_gia',
  'ten_the_loai',
  'ten_nxb',
  'nam_xuat_ban',
  'ngon_ngu',
  'so_ban_san_sang',
] as const;

/** sp_them_ban_sach: danh sách bản vừa nhập */
export const THEM_BAN_SACH_COLUMNS = [
  'ma_ban_sach',
  'vi_tri_ke',
  'tinh_trang',
] as const;

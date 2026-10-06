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

// Cột trả về của các procedure có result set (sql/04_procedures.sql)
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

export const SACH_DANG_MUON_COLUMNS = [
  'ma_phieu',
  'ma_ban_sach',
  'ma_sach',
  'ten_sach',
  'ngay_muon',
  'han_tra',
  'so_ngay_qua_han',
] as const;

export const TIEN_PHAT_COLUMNS = [
  'ma_phieu_phat',
  'loai_phat',
  'so_tien',
  'ly_do',
  'trang_thai',
  'ngay_tao',
  'ngay_thanh_toan',
] as const;

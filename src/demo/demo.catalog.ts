export type LoaiDemo = 'PROCEDURE' | 'TRIGGER' | 'FUNCTION' | 'CURSOR';

export interface ThamSoDemo {
  ten: string;
  nhan: string;
  kieu: 'text' | 'number' | 'date';
  macDinh?: string;
  /** Cho phép để trống (truyền NULL). */
  tuyChon?: boolean;
  /** Câu SELECT trả `gia_tri`, `mo_ta` để gợi ý giá trị đang có trong CSDL. */
  goiY?: string;
}

export interface BangDemo {
  nhan: string;
  /** SELECT chỉ đọc; `:ten_tham_so` được bind an toàn. */
  sql: string;
}

export interface TinhHuongDemo {
  nhan: string;
  thamSo: Record<string, string>;
}

export interface MucDemo {
  id: string;
  loai: LoaiDemo;
  /** Tên routine/trigger đọc nguyên văn từ CSDL để trình bày câu SQL (B2). */
  doiTuong: string[];
  tieuDe: string;
  /** B1: bài toán nhóm tự đặt. */
  baiToan: string;
  thamSo: ThamSoDemo[];
  tinhHuong?: TinhHuongDemo[];
  /** B4: câu lệnh thực thi (`:ten_tham_so`). */
  lenh: string;
  /**
   * CALL: procedure không có result set; CALL_KQ: có result set (`cot` = tên cột để hiện tiêu đề cả khi kết quả rỗng);
   * SELECT: function/truy vấn; DML: câu INSERT/UPDATE làm trigger chạy.
   */
  chay: 'CALL' | 'CALL_KQ' | 'SELECT' | 'DML';
  cot?: readonly string[];
  /** B3 (trước khi chạy) và B5 (sau khi chạy). */
  bang: BangDemo[];
}

// Các câu SQL bảng liên quan dùng chung
const CT_THEO_BAN_SACH = `
SELECT c.id, p.ma_phieu, b.ma_ban_sach, u.ma_nguoi_dung, c.han_tra, c.ngay_tra, c.tinh_trang_tra, c.so_lan_gia_han
FROM ct_phieu_muon c
JOIN phieu_muon p ON p.id = c.phieu_muon_id
JOIN nguoi_dung u ON u.id = p.nguoi_dung_id
JOIN ban_sach b ON b.id = c.ban_sach_id
WHERE b.ma_ban_sach = :ma_ban_sach
ORDER BY c.id`;

const BAN_SACH_THEO_MA = `
SELECT ma_ban_sach, vi_tri_ke, ngay_nhap, tinh_trang
FROM ban_sach
WHERE ma_ban_sach = :ma_ban_sach`;

const PHAT_THEO_BAN_SACH = `
SELECT pp.id, b.ma_ban_sach, pp.loai_phat, pp.so_tien, pp.trang_thai, pp.ngay_tao, pp.ngay_thanh_toan
FROM phieu_phat pp
JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
JOIN ban_sach b ON b.id = c.ban_sach_id
WHERE b.ma_ban_sach = :ma_ban_sach
ORDER BY pp.id`;

const NHAT_KY_MOI_NHAT = (loai: string) => `
SELECT k.id, u.ma_nguoi_dung, k.loai_hanh_vi, k.doi_tuong, k.doi_tuong_id, k.mo_ta, k.thoi_gian
FROM nhat_ky_hanh_vi k
LEFT JOIN nguoi_dung u ON u.id = k.nguoi_dung_id
WHERE k.loai_hanh_vi = '${loai}'
ORDER BY k.id DESC
LIMIT 5`;

const DAT_TRUOC_THEO_SACH = `
SELECT d.id, u.ma_nguoi_dung, s.ma_sach, b.ma_ban_sach, d.ngay_dat, d.han_giu, d.trang_thai
FROM dat_truoc d
JOIN nguoi_dung u ON u.id = d.nguoi_dung_id
JOIN sach s ON s.id = d.sach_id
LEFT JOIN ban_sach b ON b.id = d.ban_sach_id
WHERE s.ma_sach = :ma_sach
ORDER BY d.id`;

const BAN_SACH_THEO_SACH = `
SELECT b.ma_ban_sach, s.ma_sach, b.vi_tri_ke, b.tinh_trang
FROM ban_sach b
JOIN sach s ON s.id = b.sach_id
WHERE s.ma_sach = :ma_sach
ORDER BY b.id`;

const GOI_Y_LUOT_MUON_DANG_MO = `
SELECT b.ma_ban_sach AS gia_tri,
       CONCAT(u.ma_nguoi_dung, ' mượn, hạn trả ', DATE_FORMAT(c.han_tra, '%Y-%m-%d')) AS mo_ta
FROM ct_phieu_muon c
JOIN phieu_muon p ON p.id = c.phieu_muon_id
JOIN nguoi_dung u ON u.id = p.nguoi_dung_id
JOIN ban_sach b ON b.id = c.ban_sach_id
WHERE c.ngay_tra IS NULL
ORDER BY b.ma_ban_sach`;

const GOI_Y_NGUOI_DUNG = `
SELECT ma_nguoi_dung AS gia_tri, CONCAT(ho_ten, ' (', loai_nguoi_dung, ', ', trang_thai, ')') AS mo_ta
FROM nguoi_dung
ORDER BY ma_nguoi_dung`;

const GOI_Y_SACH = `
SELECT s.ma_sach AS gia_tri,
       CONCAT(s.ten_sach, ' - ', SUM(b.tinh_trang = 'SAN_SANG'), '/', COUNT(b.id), ' bản sẵn sàng') AS mo_ta
FROM sach s
JOIN ban_sach b ON b.sach_id = s.id
GROUP BY s.id, s.ma_sach, s.ten_sach
ORDER BY s.ma_sach`;

const NGUOI_DUNG_VA_TAI_KHOAN = `
SELECT u.ma_nguoi_dung, u.loai_nguoi_dung, u.trang_thai AS trang_thai_nguoi_dung,
       t.ten_dang_nhap, t.vai_tro, t.trang_thai AS trang_thai_tai_khoan
FROM nguoi_dung u
LEFT JOIN tai_khoan t ON t.nguoi_dung_id = u.id
WHERE u.ma_nguoi_dung = :ma_nguoi_dung`;

const PHIEU_PHAT_THEO_ID = `
SELECT pp.id, b.ma_ban_sach, pp.loai_phat, pp.so_tien, pp.trang_thai, pp.ngay_tao, pp.ngay_thanh_toan
FROM phieu_phat pp
JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
JOIN ban_sach b ON b.id = c.ban_sach_id
WHERE pp.id = :phieu_phat_id`;

const GOI_Y_PHIEU_PHAT = `
SELECT pp.id AS gia_tri,
       CONCAT(pp.loai_phat, ' ', pp.so_tien, ' - ', pp.trang_thai) AS mo_ta
FROM phieu_phat pp
ORDER BY pp.id`;

const MA_NGUOI_DUNG: ThamSoDemo = {
  ten: 'ma_nguoi_dung',
  nhan: 'Mã người dùng',
  kieu: 'text',
  goiY: GOI_Y_NGUOI_DUNG,
};

export const DEMO_CATALOG: MucDemo[] = [
  // ---------- STORED PROCEDURE ----------
  {
    id: 'sp-tra-cuu-sach',
    loai: 'PROCEDURE',
    doiTuong: ['sp_tra_cuu_sach'],
    tieuDe: 'Tra cứu sách theo từ khóa',
    baiToan:
      'Xây dựng Procedure tra cứu sách theo từ khóa (tên sách, tác giả, mô tả) kèm số bản sẵn sàng; nếu biết người tra cứu thì ghi nhật ký hành vi TRA_CUU.',
    thamSo: [
      {
        ten: 'tu_khoa',
        nhan: 'Từ khóa (để trống = tập rỗng)',
        kieu: 'text',
        macDinh: 'dữ liệu',
        tuyChon: true,
      },
      {
        ten: 'ma_nguoi_dung',
        nhan: 'Mã người tra cứu (để trống = không ghi nhật ký)',
        kieu: 'text',
        macDinh: 'SV001',
        tuyChon: true,
        goiY: GOI_Y_NGUOI_DUNG,
      },
    ],
    tinhHuong: [
      {
        nhan: 'Tra cứu "dữ liệu" (có ghi nhật ký)',
        thamSo: { tu_khoa: 'dữ liệu', ma_nguoi_dung: 'SV001' },
      },
      {
        nhan: 'Tra cứu không ghi nhật ký',
        thamSo: { tu_khoa: 'Java', ma_nguoi_dung: '' },
      },
      {
        nhan: 'Từ khóa rỗng (trả tập rỗng)',
        thamSo: { tu_khoa: '', ma_nguoi_dung: 'SV001' },
      },
    ],
    lenh: 'CALL sp_tra_cuu_sach(:tu_khoa, :ma_nguoi_dung)',
    chay: 'CALL_KQ',
    cot: [
      'ma_sach',
      'isbn',
      'ten_sach',
      'ds_tac_gia',
      'ten_the_loai',
      'ten_nxb',
      'nam_xuat_ban',
      'ngon_ngu',
      'so_ban_san_sang',
    ],
    bang: [
      {
        nhan: 'nhat_ky_hanh_vi (5 dòng TRA_CUU mới nhất)',
        sql: NHAT_KY_MOI_NHAT('TRA_CUU'),
      },
    ],
  },
  {
    id: 'sp-tra-sach',
    loai: 'PROCEDURE',
    doiTuong: ['sp_tra_sach'],
    tieuDe: 'Trả sách',
    baiToan:
      'Xây dựng Procedure trả sách theo mã bản sách và tình trạng khi trả; DB tự cập nhật bản sách, lập phiếu phạt nếu quá hạn/hư hỏng/mất và giao bản cho người đặt trước.',
    thamSo: [
      {
        ten: 'ma_ban_sach',
        nhan: 'Mã bản sách đang được mượn',
        kieu: 'text',
        macDinh: 'BS006',
        goiY: GOI_Y_LUOT_MUON_DANG_MO,
      },
      {
        ten: 'tinh_trang_tra',
        nhan: 'Tình trạng khi trả (BINH_THUONG, HU_HONG, MAT)',
        kieu: 'text',
        macDinh: 'BINH_THUONG',
      },
    ],
    tinhHuong: [
      {
        nhan: 'Trả quá hạn, sách bình thường (BS006)',
        thamSo: { ma_ban_sach: 'BS006', tinh_trang_tra: 'BINH_THUONG' },
      },
      {
        nhan: 'Trả hư hỏng (BS008)',
        thamSo: { ma_ban_sach: 'BS008', tinh_trang_tra: 'HU_HONG' },
      },
      {
        nhan: 'Bản sách không có lượt mượn mở (lỗi)',
        thamSo: { ma_ban_sach: 'BS005', tinh_trang_tra: 'BINH_THUONG' },
      },
    ],
    lenh: 'CALL sp_tra_sach(:ma_ban_sach, :tinh_trang_tra)',
    chay: 'CALL',
    bang: [
      { nhan: 'ct_phieu_muon (lượt mượn của bản sách)', sql: CT_THEO_BAN_SACH },
      { nhan: 'ban_sach', sql: BAN_SACH_THEO_MA },
      { nhan: 'phieu_phat (của bản sách)', sql: PHAT_THEO_BAN_SACH },
    ],
  },
  {
    id: 'sp-gia-han',
    loai: 'PROCEDURE',
    doiTuong: ['sp_gia_han', 'sp_gia_han_luot_muon'],
    tieuDe: 'Gia hạn sách',
    baiToan:
      'Xây dựng Procedure gia hạn lượt mượn đang mở theo mã bản sách và số ngày; từ chối khi quá hạn, vượt số ngày/số lần cho phép hoặc sách đang có người đặt trước.',
    thamSo: [
      {
        ten: 'ma_ban_sach',
        nhan: 'Mã bản sách đang được mượn',
        kieu: 'text',
        macDinh: 'BS003',
        goiY: GOI_Y_LUOT_MUON_DANG_MO,
      },
      { ten: 'so_ngay', nhan: 'Số ngày gia hạn', kieu: 'number', macDinh: '7' },
    ],
    tinhHuong: [
      {
        nhan: 'Gia hạn 7 ngày hợp lệ (BS003)',
        thamSo: { ma_ban_sach: 'BS003', so_ngay: '7' },
      },
      {
        nhan: 'Gia hạn quá số ngày tối đa (lỗi)',
        thamSo: { ma_ban_sach: 'BS003', so_ngay: '30' },
      },
      {
        nhan: 'Sách đã quá hạn (lỗi, BS001)',
        thamSo: { ma_ban_sach: 'BS001', so_ngay: '7' },
      },
    ],
    lenh: 'CALL sp_gia_han(:ma_ban_sach, :so_ngay)',
    chay: 'CALL',
    bang: [
      { nhan: 'ct_phieu_muon (lượt mượn của bản sách)', sql: CT_THEO_BAN_SACH },
      {
        nhan: 'nhat_ky_hanh_vi (5 dòng GIA_HAN mới nhất)',
        sql: NHAT_KY_MOI_NHAT('GIA_HAN'),
      },
    ],
  },
  {
    id: 'sp-dat-truoc',
    loai: 'PROCEDURE',
    doiTuong: ['sp_dat_truoc'],
    tieuDe: 'Đặt trước sách',
    baiToan:
      'Xây dựng Procedure đặt trước một đầu sách khi không còn bản sẵn sàng; từ chối nếu sách vẫn còn bản sẵn sàng, ghi nhật ký DAT_TRUOC.',
    thamSo: [
      {
        ten: 'ma_nguoi_dung',
        nhan: 'Mã người đặt',
        kieu: 'text',
        macDinh: 'SV008',
        goiY: GOI_Y_NGUOI_DUNG,
      },
      {
        ten: 'ma_sach',
        nhan: 'Mã đầu sách',
        kieu: 'text',
        macDinh: 'S004',
        goiY: GOI_Y_SACH,
      },
    ],
    tinhHuong: [
      {
        nhan: 'Đặt S004 (hết bản sẵn sàng)',
        thamSo: { ma_nguoi_dung: 'SV008', ma_sach: 'S004' },
      },
      {
        nhan: 'Đặt S003 (còn bản sẵn sàng, lỗi)',
        thamSo: { ma_nguoi_dung: 'SV008', ma_sach: 'S003' },
      },
      {
        nhan: 'Người đang nợ phạt (lỗi)',
        thamSo: { ma_nguoi_dung: 'SV005', ma_sach: 'S004' },
      },
    ],
    lenh: 'CALL sp_dat_truoc(:ma_nguoi_dung, :ma_sach)',
    chay: 'CALL',
    bang: [
      { nhan: 'dat_truoc (của đầu sách)', sql: DAT_TRUOC_THEO_SACH },
      {
        nhan: 'nhat_ky_hanh_vi (5 dòng DAT_TRUOC mới nhất)',
        sql: NHAT_KY_MOI_NHAT('DAT_TRUOC'),
      },
    ],
  },
  {
    id: 'sp-thanh-toan-phat',
    loai: 'PROCEDURE',
    doiTuong: ['sp_thanh_toan_phat'],
    tieuDe: 'Thanh toán phiếu phạt',
    baiToan:
      'Xây dựng Procedure thanh toán phiếu phạt: chỉ phiếu CHUA_THANH_TOAN mới thanh toán được; trigger tự điền ngày thanh toán và procedure ghi nhật ký THANH_TOAN_PHAT.',
    thamSo: [
      {
        ten: 'phieu_phat_id',
        nhan: 'Id phiếu phạt',
        kieu: 'number',
        macDinh: '3',
        goiY: GOI_Y_PHIEU_PHAT,
      },
    ],
    tinhHuong: [
      {
        nhan: 'Thanh toán phiếu chưa trả (id 3)',
        thamSo: { phieu_phat_id: '3' },
      },
      {
        nhan: 'Phiếu đã thanh toán (lỗi, id 1)',
        thamSo: { phieu_phat_id: '1' },
      },
    ],
    lenh: 'CALL sp_thanh_toan_phat(:phieu_phat_id)',
    chay: 'CALL',
    bang: [
      { nhan: 'phieu_phat (phiếu được chọn)', sql: PHIEU_PHAT_THEO_ID },
      {
        nhan: 'nhat_ky_hanh_vi (5 dòng THANH_TOAN_PHAT mới nhất)',
        sql: NHAT_KY_MOI_NHAT('THANH_TOAN_PHAT'),
      },
    ],
  },

  // ---------- TRIGGER ----------
  {
    id: 'trg-phieu-muon-bi',
    loai: 'TRIGGER',
    doiTuong: ['trg_phieu_muon_bi'],
    tieuDe: 'Chỉ cán bộ mới được lập phiếu mượn',
    baiToan:
      'Xây dựng Trigger BEFORE INSERT trên phieu_muon: người lập phiếu (nhan_vien_id) phải là cán bộ thư viện, ngược lại báo lỗi và không thêm phiếu.',
    thamSo: [
      {
        ten: 'ma_nguoi_muon',
        nhan: 'Mã người mượn',
        kieu: 'text',
        macDinh: 'SV001',
        goiY: GOI_Y_NGUOI_DUNG,
      },
      {
        ten: 'ma_nguoi_lap',
        nhan: 'Mã người lập phiếu',
        kieu: 'text',
        macDinh: 'SV002',
        goiY: GOI_Y_NGUOI_DUNG,
      },
    ],
    tinhHuong: [
      {
        nhan: 'Sinh viên lập phiếu (lỗi)',
        thamSo: { ma_nguoi_muon: 'SV001', ma_nguoi_lap: 'SV002' },
      },
      {
        nhan: 'Cán bộ lập phiếu (thành công)',
        thamSo: { ma_nguoi_muon: 'SV001', ma_nguoi_lap: 'CB001' },
      },
    ],
    lenh: `INSERT INTO phieu_muon(nguoi_dung_id, nhan_vien_id)
SELECT m.id, l.id
FROM nguoi_dung m, nguoi_dung l
WHERE m.ma_nguoi_dung = :ma_nguoi_muon AND l.ma_nguoi_dung = :ma_nguoi_lap`,
    chay: 'DML',
    bang: [
      {
        nhan: 'phieu_muon (5 phiếu mới nhất)',
        sql: `SELECT p.id, p.ma_phieu, m.ma_nguoi_dung AS nguoi_muon, l.ma_nguoi_dung AS nguoi_lap, p.ngay_muon, p.trang_thai
FROM phieu_muon p
JOIN nguoi_dung m ON m.id = p.nguoi_dung_id
JOIN nguoi_dung l ON l.id = p.nhan_vien_id
ORDER BY p.id DESC
LIMIT 5`,
      },
    ],
  },
  {
    id: 'trg-ctpm-bu',
    loai: 'TRIGGER',
    doiTuong: ['trg_ctpm_bu'],
    tieuDe: 'Bảo vệ lượt mượn khi sửa trực tiếp',
    baiToan:
      'Xây dựng Trigger BEFORE UPDATE trên ct_phieu_muon: không sửa lượt mượn đã trả, đổi hạn trả phải đi kèm gia hạn 1 lần, trong số ngày cho phép và chưa quá hạn.',
    thamSo: [
      {
        ten: 'ma_ban_sach',
        nhan: 'Mã bản sách',
        kieu: 'text',
        macDinh: 'BS003',
        goiY: GOI_Y_LUOT_MUON_DANG_MO,
      },
      {
        ten: 'han_tra_moi',
        nhan: 'Hạn trả mới',
        kieu: 'date',
        macDinh: '2026-10-20',
      },
    ],
    tinhHuong: [
      {
        nhan: 'Gia hạn hợp lệ (+4 ngày)',
        thamSo: { ma_ban_sach: 'BS003', han_tra_moi: '2026-10-20' },
      },
      {
        nhan: 'Gia hạn quá 7 ngày (lỗi)',
        thamSo: { ma_ban_sach: 'BS003', han_tra_moi: '2026-11-30' },
      },
      {
        nhan: 'Sửa lượt mượn đã trả (lỗi, BS005)',
        thamSo: { ma_ban_sach: 'BS005', han_tra_moi: '2026-09-15' },
      },
    ],
    lenh: `UPDATE ct_phieu_muon c
JOIN ban_sach b ON b.id = c.ban_sach_id
SET c.han_tra = :han_tra_moi, c.so_lan_gia_han = c.so_lan_gia_han + 1
WHERE b.ma_ban_sach = :ma_ban_sach`,
    chay: 'DML',
    bang: [
      { nhan: 'ct_phieu_muon (lượt mượn của bản sách)', sql: CT_THEO_BAN_SACH },
    ],
  },
  {
    id: 'trg-phieu-phat-bu',
    loai: 'TRIGGER',
    doiTuong: ['trg_phieu_phat_bu'],
    tieuDe: 'Phiếu phạt đã chốt là bất biến',
    baiToan:
      'Xây dựng Trigger BEFORE UPDATE trên phieu_phat: phiếu đã thanh toán/hủy không được sửa trạng thái hay số tiền; khi chuyển sang DA_THANH_TOAN thì tự điền ngày thanh toán.',
    thamSo: [
      {
        ten: 'phieu_phat_id',
        nhan: 'Id phiếu phạt',
        kieu: 'number',
        macDinh: '3',
        goiY: GOI_Y_PHIEU_PHAT,
      },
      {
        ten: 'trang_thai',
        nhan: 'Trạng thái mới (CHUA_THANH_TOAN, DA_THANH_TOAN, HUY)',
        kieu: 'text',
        macDinh: 'DA_THANH_TOAN',
      },
    ],
    tinhHuong: [
      {
        nhan: 'Thanh toán phiếu chưa trả (tự điền ngày)',
        thamSo: { phieu_phat_id: '3', trang_thai: 'DA_THANH_TOAN' },
      },
      {
        nhan: 'Sửa phiếu đã thanh toán (lỗi)',
        thamSo: { phieu_phat_id: '1', trang_thai: 'CHUA_THANH_TOAN' },
      },
    ],
    lenh: 'UPDATE phieu_phat SET trang_thai = :trang_thai WHERE id = :phieu_phat_id',
    chay: 'DML',
    bang: [{ nhan: 'phieu_phat (phiếu được chọn)', sql: PHIEU_PHAT_THEO_ID }],
  },
  {
    id: 'trg-ban-sach-bi',
    loai: 'TRIGGER',
    doiTuong: ['trg_ban_sach_bi', 'trg_ban_sach_ai'],
    tieuDe: 'Bản sách mới nhập giữ cho người đặt trước',
    baiToan:
      'Xây dựng Trigger BEFORE/AFTER INSERT trên ban_sach: không nhập bản ở trạng thái đang mượn/đang giữ; nếu đầu sách có người chờ thì bản mới chuyển DANG_GIU và lượt đặt sớm nhất chuyển SAN_SANG_NHAN.',
    thamSo: [
      {
        ten: 'ma_ban_sach',
        nhan: 'Mã bản sách mới',
        kieu: 'text',
        macDinh: 'BS900',
      },
      {
        ten: 'ma_sach',
        nhan: 'Mã đầu sách',
        kieu: 'text',
        macDinh: 'S004',
        goiY: GOI_Y_SACH,
      },
      {
        ten: 'tinh_trang',
        nhan: 'Tình trạng nhập',
        kieu: 'text',
        macDinh: 'SAN_SANG',
      },
    ],
    tinhHuong: [
      {
        nhan: 'Nhập bản cho đầu sách có người chờ (S004)',
        thamSo: {
          ma_ban_sach: 'BS900',
          ma_sach: 'S004',
          tinh_trang: 'SAN_SANG',
        },
      },
      {
        nhan: 'Nhập bản cho đầu sách không ai chờ (S003)',
        thamSo: {
          ma_ban_sach: 'BS900',
          ma_sach: 'S003',
          tinh_trang: 'SAN_SANG',
        },
      },
      {
        nhan: 'Nhập thẳng ở trạng thái DANG_MUON (lỗi)',
        thamSo: {
          ma_ban_sach: 'BS900',
          ma_sach: 'S004',
          tinh_trang: 'DANG_MUON',
        },
      },
    ],
    lenh: `INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap, tinh_trang)
SELECT :ma_ban_sach, s.id, 'DEMO', CURDATE(), :tinh_trang
FROM sach s
WHERE s.ma_sach = :ma_sach`,
    chay: 'DML',
    bang: [
      { nhan: 'ban_sach (của đầu sách)', sql: BAN_SACH_THEO_SACH },
      { nhan: 'dat_truoc (của đầu sách)', sql: DAT_TRUOC_THEO_SACH },
    ],
  },
  {
    id: 'trg-nguoi-dung-au',
    loai: 'TRIGGER',
    doiTuong: ['trg_nguoi_dung_au'],
    tieuDe: 'Khóa người dùng thì khóa luôn tài khoản',
    baiToan:
      'Xây dựng Trigger AFTER UPDATE trên nguoi_dung: khi người dùng bị tạm khóa/ngừng thì tài khoản đăng nhập tự chuyển KHOA; mở khóa người dùng không tự mở tài khoản.',
    thamSo: [
      {
        ten: 'ma_nguoi_dung',
        nhan: 'Mã người dùng',
        kieu: 'text',
        macDinh: 'SV003',
        goiY: GOI_Y_NGUOI_DUNG,
      },
      {
        ten: 'trang_thai',
        nhan: 'Trạng thái mới (HOAT_DONG, TAM_KHOA, NGUNG)',
        kieu: 'text',
        macDinh: 'TAM_KHOA',
      },
    ],
    tinhHuong: [
      {
        nhan: 'Tạm khóa SV003 (tài khoản tự KHOA)',
        thamSo: { ma_nguoi_dung: 'SV003', trang_thai: 'TAM_KHOA' },
      },
      {
        nhan: 'Mở lại SV007 (tài khoản vẫn KHOA)',
        thamSo: { ma_nguoi_dung: 'SV007', trang_thai: 'HOAT_DONG' },
      },
    ],
    lenh: 'UPDATE nguoi_dung SET trang_thai = :trang_thai WHERE ma_nguoi_dung = :ma_nguoi_dung',
    chay: 'DML',
    bang: [{ nhan: 'nguoi_dung và tai_khoan', sql: NGUOI_DUNG_VA_TAI_KHOAN }],
  },

  // ---------- FUNCTION ----------
  {
    id: 'fn-tien-phat-qua-han',
    loai: 'FUNCTION',
    doiTuong: ['fn_tien_phat_qua_han', 'fn_so_ngay_qua_han', 'fn_tham_so'],
    tieuDe: 'Tính số ngày quá hạn và tiền phạt',
    baiToan:
      'Xây dựng Function tính số ngày quá hạn và tiền phạt quá hạn từ hạn trả và ngày trả (chưa trả thì lấy hôm nay); đơn giá và mức trần đọc từ bảng tham_so.',
    thamSo: [
      { ten: 'han_tra', nhan: 'Hạn trả', kieu: 'date', macDinh: '2026-09-26' },
      {
        ten: 'ngay_tra',
        nhan: 'Ngày trả (để trống = hôm nay)',
        kieu: 'date',
        macDinh: '2026-10-07',
        tuyChon: true,
      },
    ],
    tinhHuong: [
      {
        nhan: 'Trả trễ 11 ngày',
        thamSo: { han_tra: '2026-09-26', ngay_tra: '2026-10-07' },
      },
      {
        nhan: 'Trả trễ lâu (chạm mức trần)',
        thamSo: { han_tra: '2026-01-01', ngay_tra: '2026-10-07' },
      },
      {
        nhan: 'Trả đúng hạn',
        thamSo: { han_tra: '2026-10-07', ngay_tra: '2026-10-07' },
      },
    ],
    lenh: `SELECT fn_so_ngay_qua_han(:han_tra, :ngay_tra) AS so_ngay_qua_han,
       fn_tien_phat_qua_han(:han_tra, :ngay_tra) AS tien_phat`,
    chay: 'SELECT',
    bang: [
      {
        nhan: 'tham_so (đơn giá và mức trần phạt)',
        sql: `SELECT ma_tham_so, gia_tri, don_vi, mo_ta FROM tham_so WHERE ma_tham_so LIKE 'PHAT%' ORDER BY ma_tham_so`,
      },
    ],
  },
  {
    id: 'fn-ly-do-khong-the-muon',
    loai: 'FUNCTION',
    doiTuong: ['fn_ly_do_khong_the_muon', 'fn_co_the_muon'],
    tieuDe: 'Kiểm tra người dùng có được mượn sách',
    baiToan:
      'Xây dựng Function trả về lý do người dùng bị chặn mượn (không hoạt động, mượn đủ số tối đa, đang giữ sách quá hạn, còn nợ phạt) hoặc NULL nếu được mượn.',
    thamSo: [{ ...MA_NGUOI_DUNG, macDinh: 'SV001' }],
    tinhHuong: [
      { nhan: 'SV001 (quá hạn, nợ phạt)', thamSo: { ma_nguoi_dung: 'SV001' } },
      { nhan: 'SV007 (bị tạm khóa)', thamSo: { ma_nguoi_dung: 'SV007' } },
      { nhan: 'SV008 (được mượn)', thamSo: { ma_nguoi_dung: 'SV008' } },
    ],
    lenh: `SELECT fn_ly_do_khong_the_muon(u.id) AS ly_do,
       fn_co_the_muon(u.id) AS co_the_muon
FROM nguoi_dung u
WHERE u.ma_nguoi_dung = :ma_nguoi_dung`,
    chay: 'SELECT',
    bang: [
      { nhan: 'nguoi_dung', sql: NGUOI_DUNG_VA_TAI_KHOAN },
      {
        nhan: 'ct_phieu_muon đang mượn của người dùng',
        sql: `SELECT p.ma_phieu, b.ma_ban_sach, c.han_tra, c.ngay_tra
FROM ct_phieu_muon c
JOIN phieu_muon p ON p.id = c.phieu_muon_id
JOIN nguoi_dung u ON u.id = p.nguoi_dung_id
JOIN ban_sach b ON b.id = c.ban_sach_id
WHERE u.ma_nguoi_dung = :ma_nguoi_dung AND c.ngay_tra IS NULL
ORDER BY c.id`,
      },
      {
        nhan: 'phieu_phat chưa thanh toán của người dùng',
        sql: `SELECT pp.id, pp.loai_phat, pp.so_tien, pp.trang_thai
FROM phieu_phat pp
JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
JOIN phieu_muon p ON p.id = c.phieu_muon_id
JOIN nguoi_dung u ON u.id = p.nguoi_dung_id
WHERE u.ma_nguoi_dung = :ma_nguoi_dung AND pp.trang_thai = 'CHUA_THANH_TOAN'
ORDER BY pp.id`,
      },
    ],
  },
  {
    id: 'fn-tham-so',
    loai: 'FUNCTION',
    doiTuong: ['fn_tham_so'],
    tieuDe: 'Đọc tham số nghiệp vụ',
    baiToan:
      'Xây dựng Function đọc tham số nghiệp vụ theo mã từ bảng tham_so để mọi quy tắc (thời hạn mượn, mức phạt...) đổi ở một chỗ; thiếu tham số thì báo lỗi.',
    thamSo: [
      {
        ten: 'ma_tham_so',
        nhan: 'Mã tham số',
        kieu: 'text',
        macDinh: 'SO_NGAY_MUON',
        goiY: `SELECT ma_tham_so AS gia_tri, mo_ta FROM tham_so ORDER BY ma_tham_so`,
      },
    ],
    tinhHuong: [
      { nhan: 'Thời hạn mượn', thamSo: { ma_tham_so: 'SO_NGAY_MUON' } },
      { nhan: 'Mã không tồn tại (lỗi)', thamSo: { ma_tham_so: 'KHONG_CO' } },
    ],
    lenh: 'SELECT fn_tham_so(:ma_tham_so) AS gia_tri',
    chay: 'SELECT',
    bang: [
      {
        nhan: 'tham_so',
        sql: 'SELECT ma_tham_so, gia_tri, don_vi, mo_ta FROM tham_so ORDER BY ma_tham_so',
      },
    ],
  },

  // ---------- CURSOR ----------
  {
    id: 'cursor-danh-dau-qua-han',
    loai: 'CURSOR',
    doiTuong: ['sp_cursor_danh_dau_qua_han'],
    tieuDe: 'Ghi nhật ký vi phạm cho lượt mượn quá hạn',
    baiToan:
      'Dùng Cursor duyệt từng lượt mượn chưa trả đã quá hạn và ghi một dòng nhật ký VI_PHAM (tối đa một lần mỗi ngày cho mỗi lượt mượn).',
    thamSo: [],
    lenh: 'CALL sp_cursor_danh_dau_qua_han()',
    chay: 'CALL',
    bang: [
      {
        nhan: 'Lượt mượn quá hạn (vw_muon_qua_han)',
        sql: 'SELECT ma_phieu, ma_nguoi_dung, ten_sach, han_tra, so_ngay_qua_han, tien_phat_tam_tinh FROM vw_muon_qua_han ORDER BY ma_phieu',
      },
      {
        nhan: 'nhat_ky_hanh_vi (5 dòng VI_PHAM mới nhất)',
        sql: NHAT_KY_MOI_NHAT('VI_PHAM'),
      },
      {
        nhan: 'Số dòng VI_PHAM hôm nay',
        sql: `SELECT COUNT(*) AS so_dong FROM nhat_ky_hanh_vi WHERE loai_hanh_vi = 'VI_PHAM' AND DATE(thoi_gian) = CURDATE()`,
      },
    ],
  },
  {
    id: 'cursor-thong-ke-muon',
    loai: 'CURSOR',
    doiTuong: ['sp_cursor_thong_ke_muon_theo_nguoi_dung'],
    tieuDe: 'Thống kê số lượt mượn theo người dùng',
    baiToan:
      'Dùng Cursor duyệt từng sinh viên/giảng viên, đếm số phiếu mượn và số bản sách đã mượn, ghi vào bảng tạm rồi trả kết quả xếp theo số sách giảm dần.',
    thamSo: [],
    lenh: 'CALL sp_cursor_thong_ke_muon_theo_nguoi_dung()',
    chay: 'CALL_KQ',
    cot: ['ma_nguoi_dung', 'ho_ten', 'so_phieu_muon', 'so_sach_da_muon'],
    bang: [
      {
        nhan: 'phieu_muon (dữ liệu nguồn cho cursor)',
        sql: `SELECT p.ma_phieu, u.ma_nguoi_dung, p.ngay_muon, p.trang_thai,
       (SELECT COUNT(*) FROM ct_phieu_muon c WHERE c.phieu_muon_id = p.id) AS so_ban_sach
FROM phieu_muon p
JOIN nguoi_dung u ON u.id = p.nguoi_dung_id
ORDER BY p.id`,
      },
    ],
  },
  {
    id: 'cursor-het-han-dat-truoc',
    loai: 'CURSOR',
    doiTuong: ['sp_cursor_het_han_dat_truoc'],
    tieuDe: 'Xử lý lượt giữ sách đã hết hạn',
    baiToan:
      'Dùng Cursor duyệt các lượt đặt trước đang giữ sách (SAN_SANG_NHAN) đã quá hạn giữ: đánh dấu HET_HAN, giao bản sách cho người kế tiếp hoặc trả về SAN_SANG.',
    thamSo: [],
    lenh: 'CALL sp_cursor_het_han_dat_truoc()',
    chay: 'CALL',
    bang: [
      {
        nhan: 'dat_truoc',
        sql: `SELECT d.id, u.ma_nguoi_dung, s.ma_sach, b.ma_ban_sach, d.han_giu, d.trang_thai
FROM dat_truoc d
JOIN nguoi_dung u ON u.id = d.nguoi_dung_id
JOIN sach s ON s.id = d.sach_id
LEFT JOIN ban_sach b ON b.id = d.ban_sach_id
ORDER BY d.id`,
      },
      {
        nhan: 'nhat_ky_hanh_vi (5 dòng HET_HAN_DAT_TRUOC mới nhất)',
        sql: NHAT_KY_MOI_NHAT('HET_HAN_DAT_TRUOC'),
      },
    ],
  },
];

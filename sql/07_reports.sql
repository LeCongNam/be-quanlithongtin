USE qltv_nhom8;

-- 07. REPORTS
-- Bản MAT/NGUNG_PHUC_VU không tính vào tổng số bản; sách chưa có bản nào vẫn hiện với số 0.
CREATE OR REPLACE VIEW vw_danh_muc_sach AS
SELECT
    s.ma_sach,
    s.ten_sach,
    tl.ten_the_loai,
    nxb.ten_nxb,
    s.nam_xuat_ban,
    COUNT(bs.id) AS tong_so_ban,
    COALESCE(SUM(bs.tinh_trang = 'SAN_SANG'), 0) AS so_ban_san_sang
FROM sach s
JOIN the_loai tl ON tl.id = s.the_loai_id
JOIN nha_xuat_ban nxb ON nxb.id = s.nxb_id
LEFT JOIN ban_sach bs ON bs.sach_id = s.id
    AND bs.tinh_trang NOT IN ('MAT','NGUNG_PHUC_VU')
GROUP BY s.id, s.ma_sach, s.ten_sach, tl.ten_the_loai, nxb.ten_nxb, s.nam_xuat_ban;

CREATE OR REPLACE VIEW vw_sach_dang_muon AS
SELECT
    p.ma_phieu,
    nd.ma_nguoi_dung,
    nd.ho_ten,
    bs.ma_ban_sach,
    s.ma_sach,
    s.ten_sach,
    p.ngay_muon,
    c.han_tra,
    fn_so_ngay_qua_han(c.han_tra, c.ngay_tra) AS so_ngay_qua_han
FROM ct_phieu_muon c
JOIN phieu_muon p ON p.id = c.phieu_muon_id
JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
JOIN ban_sach bs ON bs.id = c.ban_sach_id
JOIN sach s ON s.id = bs.sach_id
WHERE c.ngay_tra IS NULL;

CREATE OR REPLACE VIEW vw_muon_qua_han AS
SELECT
    p.ma_phieu,
    nd.ma_nguoi_dung,
    nd.ho_ten,
    s.ten_sach,
    c.han_tra,
    fn_so_ngay_qua_han(c.han_tra, c.ngay_tra) AS so_ngay_qua_han,
    fn_tien_phat_qua_han(c.han_tra, c.ngay_tra) AS tien_phat_tam_tinh
FROM ct_phieu_muon c
JOIN phieu_muon p ON p.id = c.phieu_muon_id
JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
JOIN ban_sach bs ON bs.id = c.ban_sach_id
JOIN sach s ON s.id = bs.sach_id
WHERE c.ngay_tra IS NULL
  AND c.han_tra < CURDATE();

-- Gồm cả người đã bị lập phiếu phạt và người đang giữ sách quá hạn (chưa có phiếu phạt).
CREATE OR REPLACE VIEW vw_nguoi_dung_vi_pham AS
SELECT
    nd.ma_nguoi_dung,
    nd.ho_ten,
    COALESCE(f.so_lan_phat, 0) AS so_lan_phat,
    COALESCE(f.tong_tien_phat, 0) AS tong_tien_phat,
    COALESCE(f.con_no, 0) AS con_no,
    COALESCE(q.so_sach_qua_han, 0) AS so_sach_dang_qua_han,
    COALESCE(q.tien_phat_tam_tinh, 0) AS tien_phat_tam_tinh
FROM nguoi_dung nd
LEFT JOIN (
    SELECT
        p.nguoi_dung_id,
        COUNT(pp.id) AS so_lan_phat,
        SUM(pp.so_tien) AS tong_tien_phat,
        SUM(CASE WHEN pp.trang_thai = 'CHUA_THANH_TOAN' THEN pp.so_tien ELSE 0 END) AS con_no
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE pp.trang_thai <> 'HUY'
    GROUP BY p.nguoi_dung_id
) f ON f.nguoi_dung_id = nd.id
LEFT JOIN (
    SELECT
        p.nguoi_dung_id,
        COUNT(*) AS so_sach_qua_han,
        SUM(fn_tien_phat_qua_han(c.han_tra, c.ngay_tra)) AS tien_phat_tam_tinh
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE c.ngay_tra IS NULL
      AND c.han_tra < CURDATE()
    GROUP BY p.nguoi_dung_id
) q ON q.nguoi_dung_id = nd.id
WHERE f.nguoi_dung_id IS NOT NULL
   OR q.nguoi_dung_id IS NOT NULL;

CREATE OR REPLACE VIEW vw_top_sach_muon_nhieu AS
SELECT
    s.ma_sach,
    s.ten_sach,
    COUNT(c.id) AS so_luot_muon
FROM ct_phieu_muon c
JOIN ban_sach bs ON bs.id = c.ban_sach_id
JOIN sach s ON s.id = bs.sach_id
GROUP BY s.id, s.ma_sach, s.ten_sach
ORDER BY so_luot_muon DESC, s.ma_sach;

-- Tra cứu sách: có tác giả và số bản sẵn sàng
CREATE OR REPLACE VIEW vw_tra_cuu_sach AS
SELECT
    s.ma_sach,
    s.isbn,
    s.ten_sach,
    tg.ds_tac_gia,
    tl.ten_the_loai,
    nxb.ten_nxb,
    s.nam_xuat_ban,
    s.ngon_ngu,
    COALESCE(b.so_ban_san_sang, 0) AS so_ban_san_sang
FROM sach s
JOIN the_loai tl ON tl.id = s.the_loai_id
JOIN nha_xuat_ban nxb ON nxb.id = s.nxb_id
LEFT JOIN (
    SELECT stg.sach_id,
           GROUP_CONCAT(t.ten_tac_gia ORDER BY t.ten_tac_gia SEPARATOR ', ') AS ds_tac_gia
    FROM sach_tac_gia stg
    JOIN tac_gia t ON t.id = stg.tac_gia_id
    GROUP BY stg.sach_id
) tg ON tg.sach_id = s.id
LEFT JOIN (
    SELECT sach_id, SUM(tinh_trang = 'SAN_SANG') AS so_ban_san_sang
    FROM ban_sach
    GROUP BY sach_id
) b ON b.sach_id = s.id;

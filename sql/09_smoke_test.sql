USE qltv_nhom8;

-- 09. SMOKE TEST
SELECT COUNT(*) AS so_the_loai FROM the_loai;
SELECT COUNT(*) AS so_sach FROM sach;
SELECT COUNT(*) AS so_ban_sach FROM ban_sach;
SELECT COUNT(*) AS so_nguoi_dung FROM nguoi_dung;
SELECT * FROM vw_danh_muc_sach ORDER BY ma_sach;
SELECT * FROM vw_sach_dang_muon;
SELECT * FROM vw_muon_qua_han;
SELECT * FROM vw_nguoi_dung_vi_pham;
SELECT * FROM vw_top_sach_muon_nhieu LIMIT 10;

SELECT fn_so_ngay_qua_han(DATE_SUB(CURDATE(), INTERVAL 3 DAY), CURDATE()) AS test_so_ngay_qua_han;
SELECT fn_tien_phat_qua_han(DATE_SUB(CURDATE(), INTERVAL 3 DAY), CURDATE()) AS test_tien_phat;

CALL sp_cursor_thong_ke_muon_theo_nguoi_dung();

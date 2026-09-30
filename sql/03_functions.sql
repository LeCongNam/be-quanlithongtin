USE qltv_nhom8;

-- 03. FUNCTIONS
DELIMITER $$

DROP FUNCTION IF EXISTS fn_so_ngay_qua_han$$
CREATE FUNCTION fn_so_ngay_qua_han(p_han_tra DATE, p_ngay_tra DATE)
RETURNS INT
DETERMINISTIC
BEGIN
    RETURN GREATEST(DATEDIFF(COALESCE(p_ngay_tra, CURDATE()), p_han_tra), 0);
END$$

DROP FUNCTION IF EXISTS fn_tien_phat_qua_han$$
CREATE FUNCTION fn_tien_phat_qua_han(p_han_tra DATE, p_ngay_tra DATE)
RETURNS DECIMAL(12,2)
DETERMINISTIC
BEGIN
    RETURN fn_so_ngay_qua_han(p_han_tra, p_ngay_tra) * 5000;
END$$

DROP FUNCTION IF EXISTS fn_co_the_muon$$
CREATE FUNCTION fn_co_the_muon(p_nguoi_dung_id BIGINT)
RETURNS TINYINT
READS SQL DATA
BEGIN
    DECLARE v_trang_thai VARCHAR(20);
    DECLARE v_dang_muon INT DEFAULT 0;
    DECLARE v_no_phat DECIMAL(12,2) DEFAULT 0;

    SELECT trang_thai INTO v_trang_thai
    FROM nguoi_dung
    WHERE id = p_nguoi_dung_id;

    SELECT COUNT(*) INTO v_dang_muon
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE p.nguoi_dung_id = p_nguoi_dung_id
      AND c.ngay_tra IS NULL;

    SELECT COALESCE(SUM(pp.so_tien),0) INTO v_no_phat
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE p.nguoi_dung_id = p_nguoi_dung_id
      AND pp.trang_thai = 'CHUA_THANH_TOAN';

    RETURN IF(v_trang_thai = 'HOAT_DONG' AND v_dang_muon < 5 AND v_no_phat = 0, 1, 0);
END$$

DELIMITER ;

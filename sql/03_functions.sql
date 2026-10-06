USE qltv_nhom8;

-- 03. FUNCTIONS
DELIMITER $$

-- Đọc tham số nghiệp vụ từ bảng tham_so
DROP FUNCTION IF EXISTS fn_tham_so$$
CREATE FUNCTION fn_tham_so(p_ma VARCHAR(40))
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
    DECLARE v_gia_tri DECIMAL(12,2);

    SELECT gia_tri INTO v_gia_tri
    FROM tham_so
    WHERE ma_tham_so = p_ma;

    IF v_gia_tri IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Thieu tham so nghiep vu';
    END IF;

    RETURN v_gia_tri;
END$$

-- Không DETERMINISTIC vì dùng CURDATE() khi chưa trả; NO SQL vì không đọc bảng nào
DROP FUNCTION IF EXISTS fn_so_ngay_qua_han$$
CREATE FUNCTION fn_so_ngay_qua_han(p_han_tra DATE, p_ngay_tra DATE)
RETURNS INT
NOT DETERMINISTIC
NO SQL
BEGIN
    RETURN GREATEST(DATEDIFF(COALESCE(p_ngay_tra, CURDATE()), p_han_tra), 0);
END$$

-- Tiền phạt quá hạn có trần PHAT_QUA_HAN_TOI_DA mỗi lượt mượn
DROP FUNCTION IF EXISTS fn_tien_phat_qua_han$$
CREATE FUNCTION fn_tien_phat_qua_han(p_han_tra DATE, p_ngay_tra DATE)
RETURNS DECIMAL(12,2)
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    RETURN LEAST(
        fn_so_ngay_qua_han(p_han_tra, p_ngay_tra) * fn_tham_so('PHAT_QUA_HAN_NGAY'),
        fn_tham_so('PHAT_QUA_HAN_TOI_DA')
    );
END$$

-- Tiền đền mất sách: mức cao hơn giữa PHAT_MAT_SACH và giá bìa (nếu đã biết)
DROP FUNCTION IF EXISTS fn_tien_phat_mat_sach$$
CREATE FUNCTION fn_tien_phat_mat_sach(p_ban_sach_id BIGINT)
RETURNS DECIMAL(12,2)
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_gia DECIMAL(12,2);

    SELECT s.gia_bia INTO v_gia
    FROM ban_sach b
    JOIN sach s ON s.id = b.sach_id
    WHERE b.id = p_ban_sach_id;

    RETURN GREATEST(fn_tham_so('PHAT_MAT_SACH'), COALESCE(v_gia, 0));
END$$

-- Lý do KHÔNG được đặt trước hoặc mượn (người dùng không hoạt động, giữ sách quá hạn, còn nợ phạt),
-- hoặc NULL nếu không bị chặn. FOR SHARE đọc bản mới nhất thay vì snapshot REPEATABLE READ.
DROP FUNCTION IF EXISTS fn_ly_do_khong_the_dat_truoc$$
CREATE FUNCTION fn_ly_do_khong_the_dat_truoc(p_nguoi_dung_id BIGINT)
RETURNS VARCHAR(100)
READS SQL DATA
BEGIN
    DECLARE v_trang_thai VARCHAR(20);
    DECLARE v_qua_han INT DEFAULT 0;
    DECLARE v_no_phat DECIMAL(12,2) DEFAULT 0;

    SELECT trang_thai INTO v_trang_thai
    FROM nguoi_dung
    WHERE id = p_nguoi_dung_id;

    IF v_trang_thai IS NULL THEN
        RETURN 'Nguoi dung khong ton tai';
    END IF;

    IF v_trang_thai <> 'HOAT_DONG' THEN
        RETURN 'Nguoi dung khong hoat dong';
    END IF;

    SELECT COUNT(*) INTO v_qua_han
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE p.nguoi_dung_id = p_nguoi_dung_id
      AND c.ngay_tra IS NULL
      AND c.han_tra < CURDATE()
    FOR SHARE;

    IF v_qua_han > 0 THEN
        RETURN 'Dang giu sach qua han chua tra';
    END IF;

    SELECT COALESCE(SUM(pp.so_tien), 0) INTO v_no_phat
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE p.nguoi_dung_id = p_nguoi_dung_id
      AND pp.trang_thai = 'CHUA_THANH_TOAN';

    IF v_no_phat > 0 THEN
        RETURN 'Con no tien phat chua thanh toan';
    END IF;

    RETURN NULL;
END$$

-- Trả về lý do KHÔNG được mượn, hoặc NULL nếu được mượn (= điều kiện đặt trước + chưa mượn đủ số tối đa)
DROP FUNCTION IF EXISTS fn_ly_do_khong_the_muon$$
CREATE FUNCTION fn_ly_do_khong_the_muon(p_nguoi_dung_id BIGINT)
RETURNS VARCHAR(100)
READS SQL DATA
BEGIN
    DECLARE v_ly_do VARCHAR(100);
    DECLARE v_dang_muon INT DEFAULT 0;

    SET v_ly_do = fn_ly_do_khong_the_dat_truoc(p_nguoi_dung_id);
    IF v_ly_do IS NOT NULL THEN
        RETURN v_ly_do;
    END IF;

    -- FOR SHARE: đọc bản mới nhất đã commit thay vì snapshot REPEATABLE READ của phiên hiện tại.
    -- Nếu không, hai phiên cùng mượn cho một người (khác bản sách) có thể cùng thấy số lượt mượn cũ
    -- và cùng vượt SO_SACH_TOI_DA dù trigger đã khóa hàng nguoi_dung.
    SELECT COUNT(*) INTO v_dang_muon
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE p.nguoi_dung_id = p_nguoi_dung_id
      AND c.ngay_tra IS NULL
    FOR SHARE;

    IF v_dang_muon >= fn_tham_so('SO_SACH_TOI_DA') THEN
        RETURN 'Da muon toi da so sach cho phep';
    END IF;

    RETURN NULL;
END$$

DROP FUNCTION IF EXISTS fn_co_the_muon$$
CREATE FUNCTION fn_co_the_muon(p_nguoi_dung_id BIGINT)
RETURNS TINYINT
READS SQL DATA
BEGIN
    RETURN IF(fn_ly_do_khong_the_muon(p_nguoi_dung_id) IS NULL, 1, 0);
END$$

DELIMITER ;

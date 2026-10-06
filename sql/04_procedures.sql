USE qltv_nhom8;

-- 04. PROCEDURES
-- Các procedure không tự mở transaction: ứng dụng có thể bọc START TRANSACTION/COMMIT bên ngoài.
-- Chống mượn trùng/đặt trước trùng khi chạy đồng thời dựa vào UNIQUE (cột sinh tự động) + khóa hàng trong trigger.
DELIMITER $$

-- Nội bộ: bản sách vừa được giải phóng -> giao cho người đặt trước sớm nhất, nếu không có thì SAN_SANG.
DROP PROCEDURE IF EXISTS sp_cap_phat_ban_sach$$
CREATE PROCEDURE sp_cap_phat_ban_sach(IN p_ban_sach_id BIGINT)
BEGIN
    DECLARE v_sach_id BIGINT;
    DECLARE v_dt_id BIGINT;
    DECLARE v_nguoi_dung_id BIGINT;

    SELECT sach_id INTO v_sach_id
    FROM ban_sach
    WHERE id = p_ban_sach_id;

    SELECT d.id, d.nguoi_dung_id INTO v_dt_id, v_nguoi_dung_id
    FROM dat_truoc d
    JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
    WHERE d.sach_id = v_sach_id
      AND d.trang_thai = 'CHO_XU_LY'
      AND nd.trang_thai = 'HOAT_DONG'
    ORDER BY d.ngay_dat, d.id
    LIMIT 1
    FOR UPDATE;

    IF v_dt_id IS NULL THEN
        UPDATE ban_sach SET tinh_trang = 'SAN_SANG' WHERE id = p_ban_sach_id;
    ELSE
        UPDATE ban_sach SET tinh_trang = 'DANG_GIU' WHERE id = p_ban_sach_id;

        UPDATE dat_truoc
        SET trang_thai = 'SAN_SANG_NHAN',
            ban_sach_id = p_ban_sach_id,
            han_giu = DATE_ADD(NOW(), INTERVAL fn_tham_so('SO_NGAY_GIU_DAT_TRUOC') DAY)
        WHERE id = v_dt_id;

        INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
        VALUES(v_nguoi_dung_id, 'GIU_SACH', 'DAT_TRUOC', v_dt_id, 'Giu ban sach cho nguoi dat truoc');
    END IF;
END$$

DROP PROCEDURE IF EXISTS sp_tao_phieu_muon$$
CREATE PROCEDURE sp_tao_phieu_muon(
    IN p_ma_nguoi_dung VARCHAR(20),
    IN p_ma_nhan_vien VARCHAR(20),
    OUT p_ma_phieu VARCHAR(20)
)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_nhan_vien_id BIGINT;
    DECLARE v_id BIGINT;
    DECLARE v_ly_do VARCHAR(100);

    SELECT id INTO v_nguoi_dung_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nguoi_dung;

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay nguoi dung';
    END IF;

    SELECT id INTO v_nhan_vien_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nhan_vien
      AND loai_nguoi_dung = 'CAN_BO'
      AND trang_thai = 'HOAT_DONG';

    IF v_nhan_vien_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay can bo thu vien hop le';
    END IF;

    SET v_ly_do = fn_ly_do_khong_the_muon(v_nguoi_dung_id);
    IF v_ly_do IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_ly_do;
    END IF;

    INSERT INTO phieu_muon(nguoi_dung_id, nhan_vien_id, ngay_muon, trang_thai)
    VALUES(v_nguoi_dung_id, v_nhan_vien_id, CURDATE(), 'DANG_MUON');

    SET v_id = LAST_INSERT_ID();
    SET p_ma_phieu = CONCAT('PM', LPAD(v_id, 6, '0'));

    UPDATE phieu_muon
    SET ma_phieu = p_ma_phieu
    WHERE id = v_id;
END$$

DROP PROCEDURE IF EXISTS sp_them_sach_vao_phieu$$
CREATE PROCEDURE sp_them_sach_vao_phieu(
    IN p_ma_phieu VARCHAR(20),
    IN p_ma_ban_sach VARCHAR(30)
)
BEGIN
    DECLARE v_phieu_id BIGINT;
    DECLARE v_ngay_muon DATE;
    DECLARE v_ban_sach_id BIGINT;

    SELECT id, ngay_muon INTO v_phieu_id, v_ngay_muon
    FROM phieu_muon
    WHERE ma_phieu = p_ma_phieu
      AND trang_thai = 'DANG_MUON';

    IF v_phieu_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu muon khong ton tai hoac da dong';
    END IF;

    SELECT id INTO v_ban_sach_id
    FROM ban_sach
    WHERE ma_ban_sach = p_ma_ban_sach;

    IF v_ban_sach_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay ban sach';
    END IF;

    INSERT INTO ct_phieu_muon(phieu_muon_id, ban_sach_id, han_tra)
    VALUES(v_phieu_id, v_ban_sach_id, DATE_ADD(v_ngay_muon, INTERVAL fn_tham_so('SO_NGAY_MUON') DAY));
END$$

-- Trả sách theo mã bản sách (mỗi bản sách chỉ có tối đa 1 lượt mượn đang mở)
DROP PROCEDURE IF EXISTS sp_tra_sach$$
CREATE PROCEDURE sp_tra_sach(
    IN p_ma_ban_sach VARCHAR(30),
    IN p_tinh_trang_tra VARCHAR(20)
)
BEGIN
    DECLARE v_ct_id BIGINT;

    IF p_tinh_trang_tra IS NULL OR p_tinh_trang_tra NOT IN ('BINH_THUONG','HU_HONG','MAT') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tinh trang tra phai la BINH_THUONG, HU_HONG hoac MAT';
    END IF;

    SELECT c.id INTO v_ct_id
    FROM ct_phieu_muon c
    JOIN ban_sach b ON b.id = c.ban_sach_id
    WHERE b.ma_ban_sach = p_ma_ban_sach
      AND c.ngay_tra IS NULL;

    IF v_ct_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach khong co luot muon dang mo';
    END IF;

    UPDATE ct_phieu_muon
    SET ngay_tra = CURDATE(),
        tinh_trang_tra = p_tinh_trang_tra
    WHERE id = v_ct_id;
END$$

DROP PROCEDURE IF EXISTS sp_gia_han$$
CREATE PROCEDURE sp_gia_han(
    IN p_ma_ban_sach VARCHAR(30),
    IN p_so_ngay INT
)
BEGIN
    DECLARE v_ct_id BIGINT;
    DECLARE v_han_tra DATE;
    DECLARE v_gia_han TINYINT;
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_sach_id BIGINT;
    DECLARE v_trang_thai_nd VARCHAR(20);

    IF p_so_ngay IS NULL OR p_so_ngay < 1 OR p_so_ngay > fn_tham_so('SO_NGAY_GIA_HAN_TOI_DA') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'So ngay gia han khong hop le';
    END IF;

    SELECT c.id, c.han_tra, c.so_lan_gia_han, p.nguoi_dung_id, b.sach_id
    INTO v_ct_id, v_han_tra, v_gia_han, v_nguoi_dung_id, v_sach_id
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    JOIN ban_sach b ON b.id = c.ban_sach_id
    WHERE b.ma_ban_sach = p_ma_ban_sach
      AND c.ngay_tra IS NULL;

    IF v_ct_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach khong co luot muon dang mo';
    END IF;

    IF v_gia_han >= fn_tham_so('SO_LAN_GIA_HAN_TOI_DA') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Luot muon da gia han toi da so lan cho phep';
    END IF;

    IF v_han_tra < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sach da qua han, khong the gia han';
    END IF;

    SELECT trang_thai INTO v_trang_thai_nd
    FROM nguoi_dung
    WHERE id = v_nguoi_dung_id;

    IF v_trang_thai_nd <> 'HOAT_DONG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong hoat dong';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM dat_truoc
        WHERE sach_id = v_sach_id
          AND trang_thai = 'CHO_XU_LY'
          AND nguoi_dung_id <> v_nguoi_dung_id
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sach dang co nguoi dat truoc, khong the gia han';
    END IF;

    UPDATE ct_phieu_muon
    SET han_tra = DATE_ADD(han_tra, INTERVAL p_so_ngay DAY),
        so_lan_gia_han = so_lan_gia_han + 1
    WHERE id = v_ct_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'GIA_HAN', 'CT_PHIEU_MUON', v_ct_id, 'Gia han muon sach');
END$$

-- Chỉ được đặt trước khi đầu sách không còn bản SAN_SANG
DROP PROCEDURE IF EXISTS sp_dat_truoc$$
CREATE PROCEDURE sp_dat_truoc(
    IN p_ma_nguoi_dung VARCHAR(20),
    IN p_ma_sach VARCHAR(20)
)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_sach_id BIGINT;
    DECLARE v_dt_id BIGINT;

    SELECT id INTO v_nguoi_dung_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nguoi_dung;

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay nguoi dung';
    END IF;

    SELECT id INTO v_sach_id
    FROM sach
    WHERE ma_sach = p_ma_sach;

    IF v_sach_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay sach';
    END IF;

    IF EXISTS (SELECT 1 FROM ban_sach WHERE sach_id = v_sach_id AND tinh_trang = 'SAN_SANG') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sach con ban san sang, khong can dat truoc';
    END IF;

    INSERT INTO dat_truoc(nguoi_dung_id, sach_id, han_giu, trang_thai)
    VALUES(v_nguoi_dung_id, v_sach_id, NULL, 'CHO_XU_LY');

    SET v_dt_id = LAST_INSERT_ID();

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'DAT_TRUOC', 'DAT_TRUOC', v_dt_id, 'Dat truoc sach');
END$$

DROP PROCEDURE IF EXISTS sp_huy_dat_truoc$$
CREATE PROCEDURE sp_huy_dat_truoc(
    IN p_ma_nguoi_dung VARCHAR(20),
    IN p_ma_sach VARCHAR(20)
)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_dt_id BIGINT;
    DECLARE v_trang_thai VARCHAR(20);
    DECLARE v_ban_sach_id BIGINT;

    SELECT d.id, d.trang_thai, d.ban_sach_id, d.nguoi_dung_id
    INTO v_dt_id, v_trang_thai, v_ban_sach_id, v_nguoi_dung_id
    FROM dat_truoc d
    JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
    JOIN sach s ON s.id = d.sach_id
    WHERE nd.ma_nguoi_dung = p_ma_nguoi_dung
      AND s.ma_sach = p_ma_sach
      AND d.trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN')
    FOR UPDATE;

    IF v_dt_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong co luot dat truoc dang hoat dong';
    END IF;

    UPDATE dat_truoc SET trang_thai = 'HUY' WHERE id = v_dt_id;

    IF v_trang_thai = 'SAN_SANG_NHAN' THEN
        CALL sp_cap_phat_ban_sach(v_ban_sach_id);
    END IF;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'HUY_DAT_TRUOC', 'DAT_TRUOC', v_dt_id, 'Huy dat truoc');
END$$

DROP PROCEDURE IF EXISTS sp_thanh_toan_phat$$
CREATE PROCEDURE sp_thanh_toan_phat(IN p_phieu_phat_id BIGINT)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    SELECT p.nguoi_dung_id INTO v_nguoi_dung_id
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE pp.id = p_phieu_phat_id
      AND pp.trang_thai = 'CHUA_THANH_TOAN'
    FOR UPDATE OF pp;  -- khóa dòng phạt: hai phiên thanh toán cùng lúc thì phiên sau báo lỗi thay vì ghi trùng

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu phat khong ton tai hoac khong o trang thai chua thanh toan';
    END IF;

    UPDATE phieu_phat
    SET trang_thai = 'DA_THANH_TOAN'
    WHERE id = p_phieu_phat_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'THANH_TOAN_PHAT', 'PHIEU_PHAT', p_phieu_phat_id, 'Thanh toan phieu phat');
END$$

-- Đổi tình trạng bản sách (sửa xong, thanh lý, tìm lại...). Không áp dụng cho bản đang mượn/đang giữ.
DROP PROCEDURE IF EXISTS sp_cap_nhat_tinh_trang_ban_sach$$
CREATE PROCEDURE sp_cap_nhat_tinh_trang_ban_sach(
    IN p_ma_ban_sach VARCHAR(30),
    IN p_tinh_trang VARCHAR(20)
)
BEGIN
    DECLARE v_id BIGINT;
    DECLARE v_hien_tai VARCHAR(20);

    IF p_tinh_trang IS NULL OR p_tinh_trang NOT IN ('SAN_SANG','HU_HONG','MAT','NGUNG_PHUC_VU') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tinh trang dich khong hop le';
    END IF;

    SELECT id, tinh_trang INTO v_id, v_hien_tai
    FROM ban_sach
    WHERE ma_ban_sach = p_ma_ban_sach
    FOR UPDATE;

    IF v_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay ban sach';
    END IF;

    IF v_hien_tai IN ('DANG_MUON','DANG_GIU') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach dang muon hoac dang giu, khong doi tinh trang duoc';
    END IF;

    IF p_tinh_trang = 'SAN_SANG' THEN
        CALL sp_cap_phat_ban_sach(v_id);
    ELSE
        UPDATE ban_sach SET tinh_trang = p_tinh_trang WHERE id = v_id;
    END IF;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(NULL, 'DOI_TINH_TRANG', 'BAN_SACH', v_id, CONCAT(v_hien_tai, ' -> ', p_tinh_trang));
END$$

-- Tra cứu theo mã sách, ISBN, tên, tác giả hoặc từ khóa trong tên/mô tả (FULLTEXT)
-- p_ma_nguoi_dung: mã người tra cứu để ghi nhật ký TRA_CUU (NULL nếu ẩn danh hoặc không rõ)
DROP PROCEDURE IF EXISTS sp_tra_cuu_sach$$
CREATE PROCEDURE sp_tra_cuu_sach(IN p_tu_khoa VARCHAR(255), IN p_ma_nguoi_dung VARCHAR(20))
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    SELECT id INTO v_nguoi_dung_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nguoi_dung;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'TRA_CUU', NULL, NULL, CONCAT('Tra cuu: ', LEFT(COALESCE(p_tu_khoa, ''), 200)));

    SELECT v.*
    FROM vw_tra_cuu_sach v
    WHERE v.ma_sach = p_tu_khoa
       OR v.isbn = p_tu_khoa
       OR v.ten_sach LIKE CONCAT('%', p_tu_khoa, '%')
       OR v.ds_tac_gia LIKE CONCAT('%', p_tu_khoa, '%')
       OR v.ma_sach IN (
            SELECT s.ma_sach
            FROM sach s
            WHERE MATCH(s.ten_sach, s.mo_ta) AGAINST (p_tu_khoa IN NATURAL LANGUAGE MODE)
       )
    ORDER BY v.ten_sach;
END$$

-- Dành cho vai trò bạn đọc: ứng dụng phải truyền đúng mã của người đã đăng nhập (xem docs/04)
DROP PROCEDURE IF EXISTS sp_bandoc_sach_dang_muon$$
CREATE PROCEDURE sp_bandoc_sach_dang_muon(IN p_ma_nguoi_dung VARCHAR(20))
BEGIN
    SELECT ma_phieu, ma_ban_sach, ma_sach, ten_sach, ngay_muon, han_tra, so_ngay_qua_han
    FROM vw_sach_dang_muon
    WHERE ma_nguoi_dung = p_ma_nguoi_dung
    ORDER BY han_tra;
END$$

DROP PROCEDURE IF EXISTS sp_bandoc_tien_phat$$
CREATE PROCEDURE sp_bandoc_tien_phat(IN p_ma_nguoi_dung VARCHAR(20))
BEGIN
    SELECT pp.id AS ma_phieu_phat, pp.loai_phat, pp.so_tien, pp.ly_do, pp.trang_thai, pp.ngay_tao, pp.ngay_thanh_toan
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
    WHERE nd.ma_nguoi_dung = p_ma_nguoi_dung
    ORDER BY pp.ngay_tao DESC, pp.id DESC;
END$$

-- Hủy phiếu mượn còn rỗng (chưa ghi bản sách nào). Phiếu đã có sách thì phải trả sách, không hủy được.
DROP PROCEDURE IF EXISTS sp_huy_phieu_muon$$
CREATE PROCEDURE sp_huy_phieu_muon(IN p_ma_phieu VARCHAR(20))
BEGIN
    DECLARE v_phieu_id BIGINT;
    DECLARE v_nguoi_dung_id BIGINT;

    SELECT id, nguoi_dung_id INTO v_phieu_id, v_nguoi_dung_id
    FROM phieu_muon
    WHERE ma_phieu = p_ma_phieu
      AND trang_thai = 'DANG_MUON'
    FOR UPDATE;

    IF v_phieu_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu muon khong ton tai hoac da dong';
    END IF;

    IF EXISTS (SELECT 1 FROM ct_phieu_muon WHERE phieu_muon_id = v_phieu_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu da co sach, khong huy duoc (hay tra sach)';
    END IF;

    UPDATE phieu_muon SET trang_thai = 'HUY' WHERE id = v_phieu_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'HUY_PHIEU_MUON', 'PHIEU_MUON', v_phieu_id, 'Huy phieu muon rong');
END$$

-- Hủy phiếu phạt lập sai (chỉ khi chưa thanh toán). Thao tác nhạy cảm nên chỉ dành cho quản trị.
DROP PROCEDURE IF EXISTS sp_huy_phat$$
CREATE PROCEDURE sp_huy_phat(IN p_phieu_phat_id BIGINT, IN p_ly_do VARCHAR(200))
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    IF p_ly_do IS NULL OR CHAR_LENGTH(TRIM(p_ly_do)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phai nhap ly do huy phieu phat';
    END IF;

    SELECT p.nguoi_dung_id INTO v_nguoi_dung_id
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE pp.id = p_phieu_phat_id
      AND pp.trang_thai = 'CHUA_THANH_TOAN'
    FOR UPDATE OF pp;

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu phat khong ton tai hoac khong o trang thai chua thanh toan';
    END IF;

    UPDATE phieu_phat
    SET trang_thai = 'HUY',
        ly_do = LEFT(CONCAT(COALESCE(ly_do, ''), ' | Huy: ', TRIM(p_ly_do)), 255)
    WHERE id = p_phieu_phat_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'HUY_PHAT', 'PHIEU_PHAT', p_phieu_phat_id, 'Huy phieu phat');
END$$

DELIMITER ;

USE qltv_nhom8;

-- 04. PROCEDURES
DELIMITER $$

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

    SELECT id INTO v_nguoi_dung_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nguoi_dung;

    SELECT id INTO v_nhan_vien_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nhan_vien
      AND loai_nguoi_dung = 'CAN_BO';

    IF fn_co_the_muon(v_nguoi_dung_id) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong du dieu kien muon';
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
    DECLARE v_ban_sach_id BIGINT;

    SELECT id INTO v_phieu_id
    FROM phieu_muon
    WHERE ma_phieu = p_ma_phieu;

    SELECT id INTO v_ban_sach_id
    FROM ban_sach
    WHERE ma_ban_sach = p_ma_ban_sach;

    INSERT INTO ct_phieu_muon(phieu_muon_id, ban_sach_id, han_tra)
    VALUES(v_phieu_id, v_ban_sach_id, DATE_ADD(CURDATE(), INTERVAL 14 DAY));
END$$

DROP PROCEDURE IF EXISTS sp_tra_sach$$
CREATE PROCEDURE sp_tra_sach(
    IN p_ct_phieu_muon_id BIGINT,
    IN p_tinh_trang_tra VARCHAR(20)
)
BEGIN
    UPDATE ct_phieu_muon
    SET ngay_tra = CURDATE(),
        tinh_trang_tra = p_tinh_trang_tra
    WHERE id = p_ct_phieu_muon_id
      AND ngay_tra IS NULL;

    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chi tiet muon khong hop le hoac da tra';
    END IF;
END$$

DROP PROCEDURE IF EXISTS sp_gia_han$$
CREATE PROCEDURE sp_gia_han(
    IN p_ct_phieu_muon_id BIGINT,
    IN p_so_ngay INT
)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    IF p_so_ngay < 1 OR p_so_ngay > 7 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'So ngay gia han khong hop le';
    END IF;

    SELECT p.nguoi_dung_id INTO v_nguoi_dung_id
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE c.id = p_ct_phieu_muon_id
      AND c.ngay_tra IS NULL
      AND c.so_lan_gia_han = 0;

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong the gia han';
    END IF;

    UPDATE ct_phieu_muon
    SET han_tra = DATE_ADD(han_tra, INTERVAL p_so_ngay DAY),
        so_lan_gia_han = so_lan_gia_han + 1
    WHERE id = p_ct_phieu_muon_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'GIA_HAN', 'CT_PHIEU_MUON', p_ct_phieu_muon_id, 'Gia han muon sach');
END$$

DROP PROCEDURE IF EXISTS sp_dat_truoc$$
CREATE PROCEDURE sp_dat_truoc(
    IN p_ma_nguoi_dung VARCHAR(20),
    IN p_ma_sach VARCHAR(20)
)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_sach_id BIGINT;

    SELECT id INTO v_nguoi_dung_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nguoi_dung;

    SELECT id INTO v_sach_id
    FROM sach
    WHERE ma_sach = p_ma_sach;

    INSERT INTO dat_truoc(nguoi_dung_id, sach_id, han_giu, trang_thai)
    VALUES(v_nguoi_dung_id, v_sach_id, DATE_ADD(NOW(), INTERVAL 3 DAY), 'CHO_XU_LY');

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'DAT_TRUOC', 'SACH', v_sach_id, 'Dat truoc sach');
END$$

DELIMITER ;

USE qltv_nhom8;

-- 05. TRIGGERS
DELIMITER $$

DROP TRIGGER IF EXISTS trg_ctpm_bi$$
CREATE TRIGGER trg_ctpm_bi
BEFORE INSERT ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_tinh_trang VARCHAR(20);
    DECLARE v_nguoi_dung_id BIGINT;

    SELECT tinh_trang INTO v_tinh_trang
    FROM ban_sach
    WHERE id = NEW.ban_sach_id;

    SELECT nguoi_dung_id INTO v_nguoi_dung_id
    FROM phieu_muon
    WHERE id = NEW.phieu_muon_id
      AND trang_thai = 'DANG_MUON';

    IF v_tinh_trang <> 'SAN_SANG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach khong san sang';
    END IF;

    IF v_nguoi_dung_id IS NULL OR fn_co_the_muon(v_nguoi_dung_id) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong du dieu kien muon';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ctpm_ai$$
CREATE TRIGGER trg_ctpm_ai
AFTER INSERT ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    UPDATE ban_sach
    SET tinh_trang = 'DANG_MUON'
    WHERE id = NEW.ban_sach_id;

    SELECT nguoi_dung_id INTO v_nguoi_dung_id
    FROM phieu_muon
    WHERE id = NEW.phieu_muon_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'MUON', 'CT_PHIEU_MUON', NEW.id, 'Muon ban sach');
END$$

DROP TRIGGER IF EXISTS trg_ctpm_au$$
CREATE TRIGGER trg_ctpm_au
AFTER UPDATE ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    IF OLD.ngay_tra IS NULL AND NEW.ngay_tra IS NOT NULL THEN
        UPDATE ban_sach
        SET tinh_trang = CASE
            WHEN NEW.tinh_trang_tra = 'HU_HONG' THEN 'HU_HONG'
            WHEN NEW.tinh_trang_tra = 'MAT' THEN 'MAT'
            ELSE 'SAN_SANG'
        END
        WHERE id = NEW.ban_sach_id;

        IF fn_so_ngay_qua_han(NEW.han_tra, NEW.ngay_tra) > 0 THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'QUA_HAN', fn_tien_phat_qua_han(NEW.han_tra, NEW.ngay_tra), 'Tra sach qua han');
        END IF;

        IF NEW.tinh_trang_tra = 'HU_HONG' THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'HU_HONG', 50000, 'Sach hu hong khi tra');
        END IF;

        IF NEW.tinh_trang_tra = 'MAT' THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'MAT_SACH', 300000, 'Mat sach');
        END IF;

        SELECT nguoi_dung_id INTO v_nguoi_dung_id
        FROM phieu_muon
        WHERE id = NEW.phieu_muon_id;

        INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
        VALUES(v_nguoi_dung_id, 'TRA', 'CT_PHIEU_MUON', NEW.id, 'Tra sach');
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_dat_truoc_bi$$
CREATE TRIGGER trg_dat_truoc_bi
BEFORE INSERT ON dat_truoc
FOR EACH ROW
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_trang_thai VARCHAR(20);

    SELECT trang_thai INTO v_trang_thai
    FROM nguoi_dung
    WHERE id = NEW.nguoi_dung_id;

    SELECT COUNT(*) INTO v_count
    FROM dat_truoc
    WHERE nguoi_dung_id = NEW.nguoi_dung_id
      AND sach_id = NEW.sach_id
      AND trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN');

    IF v_trang_thai <> 'HOAT_DONG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong hoat dong';
    END IF;

    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Da co dat truoc dang hoat dong';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_phieu_phat_bu$$
CREATE TRIGGER trg_phieu_phat_bu
BEFORE UPDATE ON phieu_phat
FOR EACH ROW
BEGIN
    IF OLD.trang_thai <> 'DA_THANH_TOAN' AND NEW.trang_thai = 'DA_THANH_TOAN' THEN
        SET NEW.ngay_thanh_toan = COALESCE(NEW.ngay_thanh_toan, CURDATE());
    END IF;
END$$

DELIMITER ;

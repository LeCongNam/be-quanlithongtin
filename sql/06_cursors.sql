USE qltv_nhom8;

-- 06. CURSORS
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_cursor_danh_dau_qua_han$$
CREATE PROCEDURE sp_cursor_danh_dau_qua_han()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_ct_id BIGINT;
    DECLARE v_nguoi_dung_id BIGINT;

    DECLARE cur CURSOR FOR
        SELECT c.id, p.nguoi_dung_id
        FROM ct_phieu_muon c
        JOIN phieu_muon p ON p.id = c.phieu_muon_id
        WHERE c.ngay_tra IS NULL
          AND c.han_tra < CURDATE();

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_ct_id, v_nguoi_dung_id;

        IF done = 1 THEN
            LEAVE read_loop;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM nhat_ky_hanh_vi
            WHERE nguoi_dung_id = v_nguoi_dung_id
              AND loai_hanh_vi = 'VI_PHAM'
              AND doi_tuong = 'CT_PHIEU_MUON'
              AND doi_tuong_id = v_ct_id
              AND DATE(thoi_gian) = CURDATE()
        ) THEN
            INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
            VALUES(v_nguoi_dung_id, 'VI_PHAM', 'CT_PHIEU_MUON', v_ct_id, 'Qua han muon sach');
        END IF;
    END LOOP;

    CLOSE cur;
END$$

DROP PROCEDURE IF EXISTS sp_cursor_thong_ke_muon_theo_nguoi_dung$$
CREATE PROCEDURE sp_cursor_thong_ke_muon_theo_nguoi_dung()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_id BIGINT;
    DECLARE v_ma VARCHAR(20);
    DECLARE v_ten VARCHAR(160);
    DECLARE v_so_luot INT;

    DECLARE cur CURSOR FOR
        SELECT id, ma_nguoi_dung, ho_ten
        FROM nguoi_dung
        WHERE loai_nguoi_dung IN ('SINH_VIEN','GIANG_VIEN');

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    DROP TEMPORARY TABLE IF EXISTS tmp_thong_ke_muon;
    CREATE TEMPORARY TABLE tmp_thong_ke_muon (
        ma_nguoi_dung VARCHAR(20),
        ho_ten VARCHAR(160),
        so_luot_muon INT
    );

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_id, v_ma, v_ten;

        IF done = 1 THEN
            LEAVE read_loop;
        END IF;

        SELECT COUNT(*) INTO v_so_luot
        FROM phieu_muon
        WHERE nguoi_dung_id = v_id;

        INSERT INTO tmp_thong_ke_muon
        VALUES(v_ma, v_ten, v_so_luot);
    END LOOP;

    CLOSE cur;

    SELECT *
    FROM tmp_thong_ke_muon
    ORDER BY so_luot_muon DESC, ma_nguoi_dung;
END$$

DELIMITER ;

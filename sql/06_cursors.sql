USE qltv_nhom8;

-- 06. CURSORS
DELIMITER $$

-- Ghi nhật ký VI_PHAM (mỗi lượt mượn quá hạn tối đa 1 lần/ngày). Tiền phạt tạm tính xem ở vw_muon_qua_han;
-- phiếu phạt chính thức được lập khi trả sách. Người đang quá hạn bị chặn mượn thêm (fn_ly_do_khong_the_muon).
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

-- Thống kê theo người dùng: so_phieu_muon = số phiếu, so_sach_da_muon = số lượt mượn bản sách
-- (cùng đơn vị với vw_top_sach_muon_nhieu).
DROP PROCEDURE IF EXISTS sp_cursor_thong_ke_muon_theo_nguoi_dung$$
CREATE PROCEDURE sp_cursor_thong_ke_muon_theo_nguoi_dung()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_id BIGINT;
    DECLARE v_ma VARCHAR(20);
    DECLARE v_ten VARCHAR(160);
    DECLARE v_so_phieu INT;
    DECLARE v_so_sach INT;

    DECLARE cur CURSOR FOR
        SELECT id, ma_nguoi_dung, ho_ten
        FROM nguoi_dung
        WHERE loai_nguoi_dung IN ('SINH_VIEN','GIANG_VIEN');

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    DROP TEMPORARY TABLE IF EXISTS tmp_thong_ke_muon;
    CREATE TEMPORARY TABLE tmp_thong_ke_muon (
        ma_nguoi_dung VARCHAR(20),
        ho_ten VARCHAR(160),
        so_phieu_muon INT,
        so_sach_da_muon INT
    );

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_id, v_ma, v_ten;

        IF done = 1 THEN
            LEAVE read_loop;
        END IF;

        SELECT COUNT(*) INTO v_so_phieu
        FROM phieu_muon
        WHERE nguoi_dung_id = v_id;

        SELECT COUNT(*) INTO v_so_sach
        FROM ct_phieu_muon c
        JOIN phieu_muon p ON p.id = c.phieu_muon_id
        WHERE p.nguoi_dung_id = v_id;

        INSERT INTO tmp_thong_ke_muon
        VALUES(v_ma, v_ten, v_so_phieu, v_so_sach);
    END LOOP;

    CLOSE cur;

    SELECT *
    FROM tmp_thong_ke_muon
    ORDER BY so_sach_da_muon DESC, so_phieu_muon DESC, ma_nguoi_dung;
END$$

-- Xử lý các lượt giữ sách quá hạn: đánh dấu HET_HAN rồi giao bản sách cho người kế tiếp (hoặc trả về SAN_SANG).
-- Gọi ở autocommit = 1 (như event): mỗi lượt là một transaction riêng, lượt lỗi được hoàn tác nguyên vẹn (không để
-- HET_HAN mà bản sách kẹt DANG_GIU), các lượt sau vẫn được xử lý; cuối cùng báo lỗi nếu có lượt không xử lý được
-- (event ghi lỗi vào error log). Gọi ở autocommit = 0: chạy trong transaction của bên gọi, lỗi thì ROLLBACK và dừng
-- (xem quy ước transaction ở đầu 04_procedures.sql).
DROP PROCEDURE IF EXISTS sp_cursor_het_han_dat_truoc$$
CREATE PROCEDURE sp_cursor_het_han_dat_truoc()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_dt_id BIGINT;
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_ban_sach_id BIGINT;
    DECLARE v_con_het_han INT;
    DECLARE v_so_loi INT DEFAULT 0;
    DECLARE v_loi_cuoi VARCHAR(128);
    DECLARE v_thong_bao VARCHAR(128);
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);

    DECLARE cur CURSOR FOR
        SELECT id, nguoi_dung_id, ban_sach_id
        FROM dat_truoc
        WHERE trang_thai = 'SAN_SANG_NHAN'
          AND han_giu < NOW();

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_dt_id, v_nguoi_dung_id, v_ban_sach_id;

        IF done = 1 THEN
            LEAVE read_loop;
        END IF;

        xu_ly: BEGIN
            DECLARE EXIT HANDLER FOR SQLEXCEPTION
            BEGIN
                GET DIAGNOSTICS CONDITION 1 v_loi_cuoi = MESSAGE_TEXT;  -- đọc trước khi ROLLBACK xóa diagnostics
                ROLLBACK;
                IF NOT v_tu_mo_tx THEN
                    RESIGNAL;
                END IF;
                SET v_so_loi = v_so_loi + 1;
            END;

            IF v_tu_mo_tx THEN
                START TRANSACTION;
            END IF;

            -- Đọc lại có khóa: từ lúc mở cursor tới giờ lượt này có thể đã được mượn (DA_NHAN) hoặc hủy.
            SELECT COUNT(*) INTO v_con_het_han
            FROM dat_truoc
            WHERE id = v_dt_id
              AND trang_thai = 'SAN_SANG_NHAN'
              AND han_giu < NOW()
            FOR UPDATE;

            IF v_con_het_han = 1 THEN
                UPDATE dat_truoc SET trang_thai = 'HET_HAN' WHERE id = v_dt_id;

                CALL sp_cap_phat_ban_sach(v_ban_sach_id);

                INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
                VALUES(v_nguoi_dung_id, 'HET_HAN_DAT_TRUOC', 'DAT_TRUOC', v_dt_id, 'Het han giu sach');
            END IF;

            IF v_tu_mo_tx THEN
                COMMIT;
            END IF;
        END xu_ly;

        -- lệnh bên trong có thể làm bật NOT FOUND; chỉ FETCH mới quyết định kết thúc vòng lặp
        SET done = 0;
    END LOOP;

    CLOSE cur;

    IF v_so_loi > 0 THEN
        SET v_thong_bao = LEFT(CONCAT(v_so_loi, ' luot giu sach het han chua xu ly duoc: ', v_loi_cuoi), 128);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_thong_bao;
    END IF;
END$$

DELIMITER ;

-- Lập lịch tự động (cần event_scheduler = ON, mặc định của MySQL 8.0+; kiểm tra: SHOW VARIABLES LIKE 'event_scheduler').
-- Giữ sách hết hạn được xử lý mỗi giờ để bản sách không bị kẹt ở DANG_GIU; quá hạn mượn ghi nhật ký mỗi ngày.
DROP EVENT IF EXISTS ev_het_han_dat_truoc;
CREATE EVENT ev_het_han_dat_truoc
ON SCHEDULE EVERY 1 HOUR
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY)
DO CALL sp_cursor_het_han_dat_truoc();

DROP EVENT IF EXISTS ev_danh_dau_qua_han;
CREATE EVENT ev_danh_dau_qua_han
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 5 MINUTE)
DO CALL sp_cursor_danh_dau_qua_han();

-- Dọn phiên đăng nhập đã đăng xuất hoặc quá hạn (phiên quá hạn đã tự vô hiệu, xóa chỉ để bảng không phình ra)
DROP EVENT IF EXISTS ev_don_phien_dang_nhap;
CREATE EVENT ev_don_phien_dang_nhap
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 10 MINUTE)
DO DELETE FROM phien_dang_nhap WHERE da_dang_xuat = TRUE OR het_han < NOW();

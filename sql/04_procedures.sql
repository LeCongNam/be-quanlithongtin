USE qltv_nhom8;

-- 04. PROCEDURES
-- Transaction: mọi procedure có ghi dữ liệu đều nguyên tử, khi lỗi thì ROLLBACK rồi báo lại lỗi (RESIGNAL),
-- không để lại trạng thái nửa vời; các SELECT ... FOR UPDATE giữ khóa tới cuối nghiệp vụ. Hai cách gọi:
--   * autocommit = 1 (mặc định): procedure tự START TRANSACTION ... COMMIT.
--   * SET autocommit = 0: bên gọi tự quản lý transaction để gộp nhiều procedure (vd. lập phiếu + thêm nhiều sách)
--     rồi tự COMMIT/ROLLBACK; procedure không COMMIT, nhưng gặp lỗi vẫn ROLLBACK cả transaction của bên gọi.
--   KHÔNG bọc bằng START TRANSACTION (autocommit vẫn = 1): procedure không phân biệt được và START TRANSACTION
--   bên trong sẽ ngầm COMMIT phần việc trước đó của bên gọi (MySQL không có transaction lồng, không có @@in_transaction).
-- Ngoại lệ: sp_cap_phat_ban_sach không tự mở transaction vì được gọi từ trigger (trigger không được COMMIT);
-- nó luôn chạy bên trong transaction của procedure/câu lệnh gọi nó. Các procedure chỉ chuyển tiếp sang procedure khác
-- (sp_gia_han, sp_bandoc_*) cũng không tự mở transaction: procedure được gọi tự lo.
-- Procedure dành cho bạn đọc nhận token phiên (sp_dang_nhap) thay vì mã người dùng: xem khối "Phiên đăng nhập" bên dưới.
-- Chống mượn trùng/đặt trước trùng khi chạy đồng thời dựa vào UNIQUE (cột sinh tự động) + khóa hàng trong trigger.
DELIMITER $$

-- Nội bộ: bản sách vừa được giải phóng -> giao cho người đặt trước sớm nhất, nếu không có thì SAN_SANG.
-- Không tự mở transaction (xem đầu file).
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
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

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

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
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
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

    -- khóa phiếu: sp_huy_phieu_muon chạy đồng thời không hủy được phiếu đang được thêm sách
    SELECT id, ngay_muon INTO v_phieu_id, v_ngay_muon
    FROM phieu_muon
    WHERE ma_phieu = p_ma_phieu
      AND trang_thai = 'DANG_MUON'
    FOR UPDATE;

    IF v_phieu_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu muon khong ton tai hoac da dong';
    END IF;

    -- han_tra tính từ ngày lập phiếu; thêm sách vào phiếu cũ sẽ rút ngắn thời hạn mượn nên không cho phép.
    -- Kiểm tra ở đây chứ không ở trigger vì dữ liệu lịch sử (seed) chèn lượt mượn vào phiếu đã lập từ trước.
    IF v_ngay_muon <> CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu lap tu ngay truoc, khong them sach duoc (hay lap phieu moi)';
    END IF;

    SELECT id INTO v_ban_sach_id
    FROM ban_sach
    WHERE ma_ban_sach = p_ma_ban_sach;

    IF v_ban_sach_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay ban sach';
    END IF;

    INSERT INTO ct_phieu_muon(phieu_muon_id, ban_sach_id, han_tra)
    VALUES(v_phieu_id, v_ban_sach_id, DATE_ADD(v_ngay_muon, INTERVAL fn_tham_so('SO_NGAY_MUON') DAY));

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
END$$

-- Trả sách theo mã bản sách (mỗi bản sách chỉ có tối đa 1 lượt mượn đang mở)
DROP PROCEDURE IF EXISTS sp_tra_sach$$
CREATE PROCEDURE sp_tra_sach(
    IN p_ma_ban_sach VARCHAR(30),
    IN p_tinh_trang_tra VARCHAR(20)
)
BEGIN
    DECLARE v_ct_id BIGINT;
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

    IF p_tinh_trang_tra IS NULL OR p_tinh_trang_tra NOT IN ('BINH_THUONG','HU_HONG','MAT') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tinh trang tra phai la BINH_THUONG, HU_HONG hoac MAT';
    END IF;

    SELECT c.id INTO v_ct_id
    FROM ct_phieu_muon c
    JOIN ban_sach b ON b.id = c.ban_sach_id
    WHERE b.ma_ban_sach = p_ma_ban_sach
      AND c.ngay_tra IS NULL
    FOR UPDATE OF c;

    IF v_ct_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach khong co luot muon dang mo';
    END IF;

    UPDATE ct_phieu_muon
    SET ngay_tra = CURDATE(),
        tinh_trang_tra = p_tinh_trang_tra
    WHERE id = v_ct_id;

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
END$$

-- Gia hạn do cán bộ thực hiện (theo mã bản sách). Bạn đọc tự gia hạn qua sp_bandoc_gia_han.
-- Không tự mở transaction: sp_gia_han_luot_muon tự lo (gọi lồng hai procedure cùng mở transaction sẽ ngầm COMMIT).
DROP PROCEDURE IF EXISTS sp_gia_han$$
CREATE PROCEDURE sp_gia_han(
    IN p_ma_ban_sach VARCHAR(30),
    IN p_so_ngay INT
)
BEGIN
    CALL sp_gia_han_luot_muon(p_ma_ban_sach, p_so_ngay, NULL);
END$$

-- Nội bộ (không cấp cho ai): gia hạn lượt mượn đang mở của bản sách. p_ma_nguoi_dung khác NULL thì chỉ gia hạn khi
-- lượt mượn thuộc người đó; điều kiện nằm ngay trong câu SELECT ... FOR UPDATE nên không có khe hở giữa lúc kiểm tra
-- chủ lượt mượn và lúc khóa. Lượt mượn của người khác báo giống như không có lượt mượn (không lộ ai đang mượn).
DROP PROCEDURE IF EXISTS sp_gia_han_luot_muon$$
CREATE PROCEDURE sp_gia_han_luot_muon(
    IN p_ma_ban_sach VARCHAR(30),
    IN p_so_ngay INT,
    IN p_ma_nguoi_dung VARCHAR(20)
)
BEGIN
    DECLARE v_ct_id BIGINT;
    DECLARE v_han_tra DATE;
    DECLARE v_gia_han TINYINT;
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_sach_id BIGINT;
    DECLARE v_trang_thai_nd VARCHAR(20);
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

    IF p_so_ngay IS NULL OR p_so_ngay < 1 OR p_so_ngay > fn_tham_so('SO_NGAY_GIA_HAN_TOI_DA') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'So ngay gia han khong hop le';
    END IF;

    -- khóa lượt mượn: hai lần gia hạn đồng thời không cùng đọc so_lan_gia_han cũ
    SELECT c.id, c.han_tra, c.so_lan_gia_han, p.nguoi_dung_id, b.sach_id
    INTO v_ct_id, v_han_tra, v_gia_han, v_nguoi_dung_id, v_sach_id
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    JOIN ban_sach b ON b.id = c.ban_sach_id
    JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
    WHERE b.ma_ban_sach = p_ma_ban_sach
      AND c.ngay_tra IS NULL
      AND (p_ma_nguoi_dung IS NULL OR nd.ma_nguoi_dung = p_ma_nguoi_dung)
    FOR UPDATE OF c;

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

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
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
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

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

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
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
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

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

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
END$$

DROP PROCEDURE IF EXISTS sp_thanh_toan_phat$$
CREATE PROCEDURE sp_thanh_toan_phat(IN p_phieu_phat_id BIGINT)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

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

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
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
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

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

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
END$$

-- Tạm khóa / ngừng / mở lại bạn đọc (sinh viên, giảng viên). Thủ thư không có quyền UPDATE cột trang_thai nên phải
-- đi qua đây; đối tượng là cán bộ (thủ thư khác, quản trị) bị từ chối, chỉ quản trị đổi được trực tiếp.
-- trg_nguoi_dung_au khóa tài khoản theo khi người dùng bị khóa; mở lại tài khoản là việc riêng của quản trị.
DROP PROCEDURE IF EXISTS sp_doi_trang_thai_nguoi_dung$$
CREATE PROCEDURE sp_doi_trang_thai_nguoi_dung(
    IN p_ma_nguoi_dung VARCHAR(20),
    IN p_trang_thai VARCHAR(20)
)
BEGIN
    DECLARE v_id BIGINT;
    DECLARE v_loai VARCHAR(20);
    DECLARE v_hien_tai VARCHAR(20);
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

    IF p_trang_thai IS NULL OR p_trang_thai NOT IN ('HOAT_DONG','TAM_KHOA','NGUNG') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Trang thai nguoi dung phai la HOAT_DONG, TAM_KHOA hoac NGUNG';
    END IF;

    SELECT id, loai_nguoi_dung, trang_thai INTO v_id, v_loai, v_hien_tai
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nguoi_dung
    FOR UPDATE;

    IF v_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay nguoi dung';
    END IF;

    IF v_loai = 'CAN_BO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong doi trang thai can bo qua thu tuc nay (chi quan tri)';
    END IF;

    IF v_hien_tai = p_trang_thai THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung da o trang thai nay';
    END IF;

    UPDATE nguoi_dung SET trang_thai = p_trang_thai WHERE id = v_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_id, 'DOI_TRANG_THAI_ND', 'NGUOI_DUNG', v_id, CONCAT(v_hien_tai, ' -> ', p_trang_thai));

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
END$$

-- Thêm đầu sách mới theo mã thể loại, mã NXB và danh sách mã tác giả cách nhau bởi dấu phẩy (vd. 'TG01,TG02',
-- NULL/rỗng = chưa có tác giả). Một mã sai thì không thêm gì. Bản sách nhập riêng bằng sp_them_ban_sach;
-- muốn gộp hai bước thành một transaction thì SET autocommit = 0 (xem đầu file).
DROP PROCEDURE IF EXISTS sp_them_sach$$
CREATE PROCEDURE sp_them_sach(
    IN p_ma_sach VARCHAR(20),
    IN p_isbn VARCHAR(20),
    IN p_ten_sach VARCHAR(255),
    IN p_ma_the_loai VARCHAR(20),
    IN p_ma_nxb VARCHAR(20),
    IN p_nam_xuat_ban SMALLINT,
    IN p_ngon_ngu VARCHAR(50),
    IN p_gia_bia DECIMAL(12,2),
    IN p_mo_ta TEXT,
    IN p_ds_ma_tac_gia VARCHAR(500)
)
BEGIN
    DECLARE v_sach_id BIGINT;
    DECLARE v_the_loai_id BIGINT;
    DECLARE v_nxb_id BIGINT;
    DECLARE v_tac_gia_id BIGINT;
    DECLARE v_con_lai VARCHAR(500) DEFAULT TRIM(COALESCE(p_ds_ma_tac_gia, ''));
    DECLARE v_ma_tac_gia VARCHAR(500);
    DECLARE v_thong_bao VARCHAR(128);
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

    IF TRIM(COALESCE(p_ma_sach, '')) = '' OR TRIM(COALESCE(p_ten_sach, '')) = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phai nhap ma sach va ten sach';
    END IF;

    IF EXISTS (SELECT 1 FROM sach WHERE ma_sach = TRIM(p_ma_sach)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ma sach da ton tai';
    END IF;

    SELECT id INTO v_the_loai_id FROM the_loai WHERE ma_the_loai = p_ma_the_loai;
    IF v_the_loai_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay the loai';
    END IF;

    SELECT id INTO v_nxb_id FROM nha_xuat_ban WHERE ma_nxb = p_ma_nxb;
    IF v_nxb_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay nha xuat ban';
    END IF;

    -- năm, giá bìa, ngôn ngữ, ISBN trùng: do CHECK/UNIQUE của bảng sach kiểm tra
    INSERT INTO sach(ma_sach, isbn, ten_sach, the_loai_id, nxb_id, nam_xuat_ban, ngon_ngu, gia_bia, mo_ta)
    VALUES(TRIM(p_ma_sach), NULLIF(TRIM(p_isbn), ''), TRIM(p_ten_sach), v_the_loai_id, v_nxb_id,
           p_nam_xuat_ban, COALESCE(NULLIF(TRIM(p_ngon_ngu), ''), 'Tiếng Việt'), p_gia_bia, p_mo_ta);

    SET v_sach_id = LAST_INSERT_ID();

    WHILE v_con_lai <> '' DO
        SET v_ma_tac_gia = TRIM(SUBSTRING_INDEX(v_con_lai, ',', 1));
        SET v_con_lai = IF(LOCATE(',', v_con_lai) > 0, TRIM(SUBSTRING(v_con_lai, LOCATE(',', v_con_lai) + 1)), '');

        IF v_ma_tac_gia <> '' THEN
            SET v_tac_gia_id = NULL;
            SELECT id INTO v_tac_gia_id FROM tac_gia WHERE ma_tac_gia = v_ma_tac_gia;
            IF v_tac_gia_id IS NULL THEN
                SET v_thong_bao = CONCAT('Khong tim thay tac gia: ', LEFT(v_ma_tac_gia, 50));
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_thong_bao;
            END IF;

            -- bỏ qua mã lặp lại trong danh sách
            INSERT INTO sach_tac_gia(sach_id, tac_gia_id)
            SELECT v_sach_id, v_tac_gia_id
            FROM DUAL
            WHERE NOT EXISTS (SELECT 1 FROM sach_tac_gia WHERE sach_id = v_sach_id AND tac_gia_id = v_tac_gia_id);
        END IF;
    END WHILE;

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
END$$

-- Nhập p_so_ban bản mới cho một đầu sách, mã tự sinh tiếp theo mã lớn nhất dạng BSnnn. Bản mới vào SAN_SANG, hoặc
-- DANG_GIU nếu đầu sách đang có người chờ (trg_ban_sach_bi/ai). Trả về danh sách bản vừa nhập.
-- Khóa dòng sach để hai lần nhập cùng đầu sách không xen nhau. Hai lần nhập ĐỒNG THỜI cho hai đầu sách khác nhau có thể
-- sinh trùng mã: lần sau lỗi trùng khóa (1062) và được hoàn tác toàn bộ, ứng dụng chỉ cần gọi lại.
DROP PROCEDURE IF EXISTS sp_them_ban_sach$$
CREATE PROCEDURE sp_them_ban_sach(
    IN p_ma_sach VARCHAR(20),
    IN p_so_ban INT,
    IN p_vi_tri_ke VARCHAR(50)
)
BEGIN
    DECLARE v_sach_id BIGINT;
    DECLARE v_so BIGINT;
    DECLARE v_i INT DEFAULT 0;
    DECLARE v_id_dau BIGINT;
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

    IF p_so_ban IS NULL OR p_so_ban < 1 OR p_so_ban > 100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'So ban phai tu 1 den 100';
    END IF;

    IF TRIM(COALESCE(p_vi_tri_ke, '')) = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phai nhap vi tri ke';
    END IF;

    SELECT id INTO v_sach_id
    FROM sach
    WHERE ma_sach = p_ma_sach
    FOR UPDATE;

    IF v_sach_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay sach';
    END IF;

    SELECT COALESCE(MAX(CAST(SUBSTRING(ma_ban_sach, 3) AS UNSIGNED)), 0) INTO v_so
    FROM ban_sach
    WHERE ma_ban_sach REGEXP '^BS[0-9]+$';

    WHILE v_i < p_so_ban DO
        SET v_i = v_i + 1;
        INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap)
        VALUES(CONCAT('BS', LPAD(v_so + v_i, GREATEST(3, CHAR_LENGTH(v_so + v_i)), '0')),
               v_sach_id, TRIM(p_vi_tri_ke), CURDATE());
        IF v_i = 1 THEN
            SET v_id_dau = LAST_INSERT_ID();
        END IF;
    END WHILE;

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;

    SELECT ma_ban_sach, vi_tri_ke, tinh_trang
    FROM ban_sach
    WHERE sach_id = v_sach_id
      AND id >= v_id_dau
    ORDER BY id;
END$$

-- Tra cứu theo mã sách, ISBN, tên, tác giả hoặc từ khóa trong tên/mô tả (FULLTEXT ngram)
-- p_ma_nguoi_dung: mã người tra cứu để ghi nhật ký TRA_CUU (NULL nếu ẩn danh hoặc không rõ)
-- Từ khóa được cắt khoảng trắng hai đầu; rỗng/NULL thì trả tập rỗng và không ghi nhật ký (không có gì để tra).
-- Ký tự % _ \ trong từ khóa được hiểu theo nghĩa đen (không phải ký tự đại diện của LIKE).
-- FULLTEXT dùng BOOLEAN MODE với cả từ khóa là một cụm từ ("..."): ngram ở NATURAL LANGUAGE MODE hợp các bigram bằng OR
-- nên "Tanenbaum" khớp hầu hết danh mục; cụm từ buộc các bigram phải liền nhau. Dấu " trong từ khóa bị thay bằng khoảng trắng.
DROP PROCEDURE IF EXISTS sp_tra_cuu_sach$$
CREATE PROCEDURE sp_tra_cuu_sach(IN p_tu_khoa VARCHAR(255), IN p_ma_nguoi_dung VARCHAR(20))
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_tu_khoa VARCHAR(255) DEFAULT TRIM(COALESCE(p_tu_khoa, ''));
    DECLARE v_mau_like VARCHAR(765) DEFAULT CONCAT('%', fn_escape_like(TRIM(COALESCE(p_tu_khoa, ''))), '%');
    DECLARE v_cum_tu VARCHAR(260) DEFAULT CONCAT('"', REPLACE(TRIM(COALESCE(p_tu_khoa, '')), '"', ' '), '"');

    IF v_tu_khoa <> '' THEN
        SELECT id INTO v_nguoi_dung_id
        FROM nguoi_dung
        WHERE ma_nguoi_dung = p_ma_nguoi_dung;

        INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
        VALUES(v_nguoi_dung_id, 'TRA_CUU', NULL, NULL, CONCAT('Tra cuu: ', LEFT(v_tu_khoa, 200)));
    END IF;

    SELECT v.*
    FROM vw_tra_cuu_sach v
    WHERE v_tu_khoa <> ''
      AND (v.ma_sach = v_tu_khoa
           OR v.isbn = v_tu_khoa
           OR v.ten_sach LIKE v_mau_like
           OR v.ds_tac_gia LIKE v_mau_like
           OR v.ma_sach IN (
                SELECT s.ma_sach
                FROM sach s
                WHERE MATCH(s.ten_sach, s.mo_ta) AGAINST (v_cum_tu IN BOOLEAN MODE)
           ))
    ORDER BY v.ten_sach;
END$$

-- ===== Phiên đăng nhập và procedure dành cho bạn đọc =====
-- Bạn đọc dùng chung một user MySQL nên CSDL không biết ai đang gọi. Nếu procedure nhận "mã người dùng" tùy ý thì bạn đọc
-- A xem được phạt/sách của B và hủy được lượt đặt của B (IDOR). Vì vậy bạn đọc chỉ được gọi các procedure dưới đây:
-- đăng nhập lấy token (sp_dang_nhap), rồi mọi thao tác truyền token; CSDL tự suy ra người dùng từ token.

-- Đăng nhập bằng tài khoản trong bảng tai_khoan. Thành công trả token ngẫu nhiên 64 ký tự thập lục phân (256 bit),
-- chỉ lưu SHA-256 của nó. Mọi lý do thất bại (sai tên, sai mật khẩu, tài khoản/người dùng bị khóa) cùng một thông báo.
-- Chưa có giới hạn số lần đăng nhập sai: ứng dụng phải tự giới hạn (xem docs/05, mục Hạn chế).
DROP PROCEDURE IF EXISTS sp_dang_nhap$$
CREATE PROCEDURE sp_dang_nhap(
    IN p_ten_dang_nhap VARCHAR(80),
    IN p_mat_khau VARCHAR(255),
    OUT p_token CHAR(64)
)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET p_token = NULL;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

    SELECT tk.nguoi_dung_id INTO v_nguoi_dung_id
    FROM tai_khoan tk
    JOIN nguoi_dung nd ON nd.id = tk.nguoi_dung_id
    WHERE tk.ten_dang_nhap = p_ten_dang_nhap
      AND tk.mat_khau_hash = SHA2(CONCAT(tk.muoi, p_mat_khau), 256)
      AND tk.trang_thai = 'HOAT_DONG'
      AND nd.trang_thai = 'HOAT_DONG';

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ten dang nhap hoac mat khau khong dung';
    END IF;

    SET p_token = LOWER(HEX(RANDOM_BYTES(32)));

    INSERT INTO phien_dang_nhap(token_hash, nguoi_dung_id, het_han)
    VALUES(SHA2(p_token, 256), v_nguoi_dung_id, DATE_ADD(NOW(), INTERVAL fn_tham_so('SO_GIO_PHIEN') HOUR));

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
END$$

-- Đăng xuất: vô hiệu hóa phiên. Token không tồn tại cũng không báo lỗi (không cho dò token).
DROP PROCEDURE IF EXISTS sp_dang_xuat$$
CREATE PROCEDURE sp_dang_xuat(IN p_token VARCHAR(128))
BEGIN
    UPDATE phien_dang_nhap
    SET da_dang_xuat = TRUE
    WHERE token_hash = SHA2(p_token, 256);
END$$

-- Nội bộ (không cấp cho ai): token -> mã người dùng, báo lỗi nếu phiên không hợp lệ.
-- Chỉ đọc nên không có handler/transaction: lỗi ở đây không hoàn tác transaction của bên gọi.
DROP PROCEDURE IF EXISTS sp_xac_thuc_phien$$
CREATE PROCEDURE sp_xac_thuc_phien(IN p_token VARCHAR(128), OUT p_ma_nguoi_dung VARCHAR(20))
BEGIN
    SET p_ma_nguoi_dung = fn_nguoi_dung_tu_token(p_token);

    IF p_ma_nguoi_dung IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phien dang nhap khong hop le hoac da het han';
    END IF;
END$$

-- Các procedure sau chạy với quyền DEFINER nên gọi lại được procedure gốc dù bạn đọc không còn EXECUTE trên chúng.
-- Chúng không tự mở transaction: procedure gốc tự lo (hoặc chạy chung transaction của bên gọi khi autocommit = 0).
DROP PROCEDURE IF EXISTS sp_bandoc_sach_dang_muon$$
CREATE PROCEDURE sp_bandoc_sach_dang_muon(IN p_token VARCHAR(128))
BEGIN
    DECLARE v_ma_nguoi_dung VARCHAR(20);

    CALL sp_xac_thuc_phien(p_token, v_ma_nguoi_dung);

    SELECT ma_phieu, ma_ban_sach, ma_sach, ten_sach, ngay_muon, han_tra, so_ngay_qua_han
    FROM vw_sach_dang_muon
    WHERE ma_nguoi_dung = v_ma_nguoi_dung
    ORDER BY han_tra;
END$$

DROP PROCEDURE IF EXISTS sp_bandoc_tien_phat$$
CREATE PROCEDURE sp_bandoc_tien_phat(IN p_token VARCHAR(128))
BEGIN
    DECLARE v_ma_nguoi_dung VARCHAR(20);

    CALL sp_xac_thuc_phien(p_token, v_ma_nguoi_dung);

    SELECT pp.id AS ma_phieu_phat, pp.loai_phat, pp.so_tien, pp.ly_do, pp.trang_thai, pp.ngay_tao, pp.ngay_thanh_toan
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
    WHERE nd.ma_nguoi_dung = v_ma_nguoi_dung
    ORDER BY pp.ngay_tao DESC, pp.id DESC;
END$$

DROP PROCEDURE IF EXISTS sp_bandoc_dat_truoc$$
CREATE PROCEDURE sp_bandoc_dat_truoc(IN p_token VARCHAR(128), IN p_ma_sach VARCHAR(20))
BEGIN
    DECLARE v_ma_nguoi_dung VARCHAR(20);

    CALL sp_xac_thuc_phien(p_token, v_ma_nguoi_dung);
    CALL sp_dat_truoc(v_ma_nguoi_dung, p_ma_sach);
END$$

DROP PROCEDURE IF EXISTS sp_bandoc_huy_dat_truoc$$
CREATE PROCEDURE sp_bandoc_huy_dat_truoc(IN p_token VARCHAR(128), IN p_ma_sach VARCHAR(20))
BEGIN
    DECLARE v_ma_nguoi_dung VARCHAR(20);

    CALL sp_xac_thuc_phien(p_token, v_ma_nguoi_dung);
    CALL sp_huy_dat_truoc(v_ma_nguoi_dung, p_ma_sach);
END$$

-- Tra cứu có ghi nhật ký TRA_CUU theo đúng người đăng nhập (không tra cứu ẩn danh qua procedure; xem view vw_tra_cuu_sach)
DROP PROCEDURE IF EXISTS sp_bandoc_tra_cuu$$
CREATE PROCEDURE sp_bandoc_tra_cuu(IN p_token VARCHAR(128), IN p_tu_khoa VARCHAR(255))
BEGIN
    DECLARE v_ma_nguoi_dung VARCHAR(20);

    CALL sp_xac_thuc_phien(p_token, v_ma_nguoi_dung);
    CALL sp_tra_cuu_sach(p_tu_khoa, v_ma_nguoi_dung);
END$$

-- Bạn đọc tự gia hạn lượt mượn của mình (cùng quy tắc với cán bộ: số lần, số ngày, chưa quá hạn, không có người chờ)
DROP PROCEDURE IF EXISTS sp_bandoc_gia_han$$
CREATE PROCEDURE sp_bandoc_gia_han(IN p_token VARCHAR(128), IN p_ma_ban_sach VARCHAR(30), IN p_so_ngay INT)
BEGIN
    DECLARE v_ma_nguoi_dung VARCHAR(20);

    CALL sp_xac_thuc_phien(p_token, v_ma_nguoi_dung);
    CALL sp_gia_han_luot_muon(p_ma_ban_sach, p_so_ngay, v_ma_nguoi_dung);
END$$

-- Lịch sử mượn của bạn đọc (cả lượt đang mượn và đã trả), mới nhất trước
DROP PROCEDURE IF EXISTS sp_bandoc_lich_su_muon$$
CREATE PROCEDURE sp_bandoc_lich_su_muon(IN p_token VARCHAR(128))
BEGIN
    DECLARE v_ma_nguoi_dung VARCHAR(20);

    CALL sp_xac_thuc_phien(p_token, v_ma_nguoi_dung);

    SELECT ma_phieu, ma_ban_sach, ma_sach, ten_sach, ngay_muon, han_tra, ngay_tra, so_lan_gia_han, tinh_trang_tra,
           so_ngay_qua_han
    FROM vw_lich_su_muon
    WHERE ma_nguoi_dung = v_ma_nguoi_dung
    ORDER BY ngay_muon DESC, ma_phieu DESC, ma_ban_sach;
END$$

-- Các lượt đặt trước của bạn đọc: lượt đang hoạt động trước (thứ tự chờ, hoặc bản đang giữ và hạn giữ), rồi lượt cũ
DROP PROCEDURE IF EXISTS sp_bandoc_ds_dat_truoc$$
CREATE PROCEDURE sp_bandoc_ds_dat_truoc(IN p_token VARCHAR(128))
BEGIN
    DECLARE v_ma_nguoi_dung VARCHAR(20);

    CALL sp_xac_thuc_phien(p_token, v_ma_nguoi_dung);

    SELECT ma_sach, ten_sach, ngay_dat, trang_thai, thu_tu_cho, ma_ban_sach, han_giu
    FROM vw_dat_truoc
    WHERE ma_nguoi_dung = v_ma_nguoi_dung
    ORDER BY trang_thai IN ('CHO_XU_LY', 'SAN_SANG_NHAN') DESC, ngay_dat DESC;
END$$

-- Hủy phiếu mượn còn rỗng (chưa ghi bản sách nào). Phiếu đã có sách thì phải trả sách, không hủy được.
DROP PROCEDURE IF EXISTS sp_huy_phieu_muon$$
CREATE PROCEDURE sp_huy_phieu_muon(IN p_ma_phieu VARCHAR(20))
BEGIN
    DECLARE v_phieu_id BIGINT;
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

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

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
END$$

-- Hủy phiếu phạt lập sai (chỉ khi chưa thanh toán). Thao tác nhạy cảm nên chỉ dành cho quản trị.
DROP PROCEDURE IF EXISTS sp_huy_phat$$
CREATE PROCEDURE sp_huy_phat(IN p_phieu_phat_id BIGINT, IN p_ly_do VARCHAR(200))
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_tu_mo_tx BOOLEAN DEFAULT (@@autocommit = 1);  -- xem đầu file

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF v_tu_mo_tx THEN
        START TRANSACTION;
    END IF;

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

    IF v_tu_mo_tx THEN
        COMMIT;
    END IF;
END$$

DELIMITER ;

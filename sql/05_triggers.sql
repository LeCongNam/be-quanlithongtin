USE qltv_nhom8;

-- 05. TRIGGERS
DELIMITER $$

-- Bản sách mới nhập: không được nhập thẳng ở trạng thái đang mượn/đang giữ. Nếu đầu sách đang có người
-- chờ (CHO_XU_LY, còn đủ điều kiện đặt trước) thì bản mới chuyển DANG_GIU ngay (trg_ban_sach_ai giao cho người đặt sớm nhất), tránh
-- để người ngoài hàng đợi mượn mất. Không thể CALL sp_cap_phat_ban_sach ở đây vì thủ tục đó UPDATE
-- chính bảng ban_sach (MySQL cấm sửa bảng đang được câu lệnh gọi trigger sử dụng).
DROP TRIGGER IF EXISTS trg_ban_sach_bi$$
CREATE TRIGGER trg_ban_sach_bi
BEFORE INSERT ON ban_sach
FOR EACH ROW
BEGIN
    DECLARE v_dt_id BIGINT;

    IF NEW.tinh_trang IN ('DANG_MUON','DANG_GIU') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach moi khong duoc nhap o trang thai dang muon hoac dang giu';
    END IF;

    IF NEW.tinh_trang = 'SAN_SANG' THEN
        SELECT d.id INTO v_dt_id
        FROM dat_truoc d
        WHERE d.sach_id = NEW.sach_id
          AND d.trang_thai = 'CHO_XU_LY'
          AND fn_ly_do_khong_the_dat_truoc(d.nguoi_dung_id) IS NULL
        ORDER BY d.ngay_dat, d.id
        LIMIT 1
        FOR UPDATE;

        IF v_dt_id IS NOT NULL THEN
            SET NEW.tinh_trang = 'DANG_GIU';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ban_sach_ai$$
CREATE TRIGGER trg_ban_sach_ai
AFTER INSERT ON ban_sach
FOR EACH ROW
BEGIN
    DECLARE v_dt_id BIGINT;
    DECLARE v_nguoi_dung_id BIGINT;

    IF NEW.tinh_trang = 'DANG_GIU' THEN
        SELECT d.id, d.nguoi_dung_id INTO v_dt_id, v_nguoi_dung_id
        FROM dat_truoc d
        WHERE d.sach_id = NEW.sach_id
          AND d.trang_thai = 'CHO_XU_LY'
          AND fn_ly_do_khong_the_dat_truoc(d.nguoi_dung_id) IS NULL
        ORDER BY d.ngay_dat, d.id
        LIMIT 1
        FOR UPDATE;

        IF v_dt_id IS NOT NULL THEN
            UPDATE dat_truoc
            SET trang_thai = 'SAN_SANG_NHAN',
                ban_sach_id = NEW.id,
                han_giu = DATE_ADD(NOW(), INTERVAL fn_tham_so('SO_NGAY_GIU_DAT_TRUOC') DAY)
            WHERE id = v_dt_id;

            INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
            VALUES(v_nguoi_dung_id, 'GIU_SACH', 'DAT_TRUOC', v_dt_id, 'Giu ban sach moi nhap cho nguoi dat truoc');
        END IF;
    END IF;
END$$

-- Người lập phiếu phải là cán bộ thư viện
DROP TRIGGER IF EXISTS trg_phieu_muon_bi$$
CREATE TRIGGER trg_phieu_muon_bi
BEFORE INSERT ON phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_loai VARCHAR(20);

    SELECT loai_nguoi_dung INTO v_loai
    FROM nguoi_dung
    WHERE id = NEW.nhan_vien_id;

    IF v_loai IS NULL OR v_loai <> 'CAN_BO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nhan vien lap phieu phai la can bo thu vien';
    END IF;
END$$

-- Kiểm tra điều kiện mượn. Khóa hàng bản sách và người dùng (FOR UPDATE) để hai lượt mượn
-- đồng thời không cùng vượt qua kiểm tra.
DROP TRIGGER IF EXISTS trg_ctpm_bi$$
CREATE TRIGGER trg_ctpm_bi
BEFORE INSERT ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_tinh_trang VARCHAR(20);
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_ngay_muon DATE;
    DECLARE v_khoa BIGINT;
    DECLARE v_dt_id BIGINT;
    DECLARE v_ly_do VARCHAR(100);

    SELECT tinh_trang INTO v_tinh_trang
    FROM ban_sach
    WHERE id = NEW.ban_sach_id
    FOR UPDATE;

    SELECT nguoi_dung_id, ngay_muon INTO v_nguoi_dung_id, v_ngay_muon
    FROM phieu_muon
    WHERE id = NEW.phieu_muon_id
      AND trang_thai = 'DANG_MUON';

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu muon khong ton tai hoac da dong';
    END IF;

    SELECT id INTO v_khoa
    FROM nguoi_dung
    WHERE id = v_nguoi_dung_id
    FOR UPDATE;

    IF v_tinh_trang IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach khong ton tai';
    END IF;

    IF v_tinh_trang = 'DANG_GIU' THEN
        -- chỉ chính người đặt trước, còn hạn giữ, mới được mượn bản đang giữ
        SELECT id INTO v_dt_id
        FROM dat_truoc
        WHERE ban_sach_id = NEW.ban_sach_id
          AND trang_thai = 'SAN_SANG_NHAN'
          AND nguoi_dung_id = v_nguoi_dung_id
          AND han_giu >= NOW()
        LIMIT 1
        FOR UPDATE;

        IF v_dt_id IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach dang duoc giu cho nguoi khac';
        END IF;
    ELSEIF v_tinh_trang <> 'SAN_SANG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach khong san sang';
    END IF;

    SET v_ly_do = fn_ly_do_khong_the_muon(v_nguoi_dung_id);
    IF v_ly_do IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_ly_do;
    END IF;

    IF NEW.han_tra < v_ngay_muon THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Han tra khong duoc truoc ngay muon';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ctpm_ai$$
CREATE TRIGGER trg_ctpm_ai
AFTER INSERT ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_sach_id BIGINT;
    DECLARE v_dt_id BIGINT;
    DECLARE v_dt_trang_thai VARCHAR(20);
    DECLARE v_dt_ban_sach_id BIGINT;

    SELECT nguoi_dung_id INTO v_nguoi_dung_id
    FROM phieu_muon
    WHERE id = NEW.phieu_muon_id;

    SELECT sach_id INTO v_sach_id
    FROM ban_sach
    WHERE id = NEW.ban_sach_id;

    UPDATE ban_sach
    SET tinh_trang = 'DANG_MUON'
    WHERE id = NEW.ban_sach_id;

    -- Người mượn đang có lượt đặt trước hoạt động cho đầu sách này (tối đa 1, nhờ uq_dt_dang_hoat_dong) -> lượt đặt
    -- hoàn tất, dù họ mượn đúng bản đang giữ hay mượn thẳng một bản SAN_SANG (vd. lúc nhập bản mới họ đang bị tạm
    -- khóa nên bị bỏ qua). Nếu họ đang được giữ một bản KHÁC thì bản đó được giao cho người kế tiếp (hoặc SAN_SANG),
    -- tránh bị giữ vô ích tới hết hạn.
    SELECT id, trang_thai, ban_sach_id INTO v_dt_id, v_dt_trang_thai, v_dt_ban_sach_id
    FROM dat_truoc
    WHERE nguoi_dung_id = v_nguoi_dung_id
      AND sach_id = v_sach_id
      AND trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN')
    FOR UPDATE;

    IF v_dt_id IS NOT NULL THEN
        UPDATE dat_truoc
        SET trang_thai = 'DA_NHAN',
            ban_sach_id = NEW.ban_sach_id
        WHERE id = v_dt_id;

        IF v_dt_trang_thai = 'SAN_SANG_NHAN' AND v_dt_ban_sach_id <> NEW.ban_sach_id THEN
            CALL sp_cap_phat_ban_sach(v_dt_ban_sach_id);
        END IF;
    END IF;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'MUON', 'CT_PHIEU_MUON', NEW.id, 'Muon ban sach');
END$$

-- Bảo vệ dữ liệu khi UPDATE trực tiếp: không sửa lượt mượn đã trả; đổi hạn phải là gia hạn hợp lệ.
DROP TRIGGER IF EXISTS trg_ctpm_bu$$
CREATE TRIGGER trg_ctpm_bu
BEFORE UPDATE ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_trang_thai_nd VARCHAR(20);
    DECLARE v_sach_id BIGINT;

    IF NEW.phieu_muon_id <> OLD.phieu_muon_id OR NEW.ban_sach_id <> OLD.ban_sach_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong duoc doi phieu muon hoac ban sach cua chi tiet muon';
    END IF;

    IF OLD.ngay_tra IS NOT NULL
       AND (NOT (NEW.ngay_tra <=> OLD.ngay_tra)
            OR NOT (NEW.tinh_trang_tra <=> OLD.tinh_trang_tra)
            OR NEW.han_tra <> OLD.han_tra
            OR NEW.so_lan_gia_han <> OLD.so_lan_gia_han) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chi tiet muon da tra, khong duoc sua';
    END IF;

    IF OLD.ngay_tra IS NULL AND NEW.ngay_tra IS NOT NULL AND NEW.tinh_trang_tra IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phai co tinh trang tra khi tra sach';
    END IF;

    IF NEW.han_tra <> OLD.han_tra THEN
        IF NEW.so_lan_gia_han <> OLD.so_lan_gia_han + 1 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Doi han tra phai di kem gia han 1 lan';
        END IF;

        IF DATEDIFF(NEW.han_tra, OLD.han_tra) < 1
           OR DATEDIFF(NEW.han_tra, OLD.han_tra) > fn_tham_so('SO_NGAY_GIA_HAN_TOI_DA') THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'So ngay gia han vuot quy dinh';
        END IF;

        IF NEW.so_lan_gia_han > fn_tham_so('SO_LAN_GIA_HAN_TOI_DA') THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Luot muon da gia han toi da so lan cho phep';
        END IF;

        IF OLD.han_tra < CURDATE() THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sach da qua han, khong the gia han';
        END IF;

        SELECT p.nguoi_dung_id, nd.trang_thai INTO v_nguoi_dung_id, v_trang_thai_nd
        FROM phieu_muon p
        JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
        WHERE p.id = NEW.phieu_muon_id;

        IF v_trang_thai_nd IS NULL OR v_trang_thai_nd <> 'HOAT_DONG' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong hoat dong';
        END IF;

        SELECT sach_id INTO v_sach_id
        FROM ban_sach
        WHERE id = NEW.ban_sach_id;

        -- chỉ tính người chờ còn đủ điều kiện (như sp_cap_phat_ban_sach)
        IF EXISTS (
            SELECT 1
            FROM dat_truoc
            WHERE sach_id = v_sach_id
              AND trang_thai = 'CHO_XU_LY'
              AND nguoi_dung_id <> v_nguoi_dung_id
              AND fn_ly_do_khong_the_dat_truoc(nguoi_dung_id) IS NULL
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sach dang co nguoi dat truoc, khong the gia han';
        END IF;
    ELSEIF NEW.so_lan_gia_han <> OLD.so_lan_gia_han THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong duoc doi so lan gia han khi khong doi han tra';
    END IF;
END$$

-- Khi trả sách: cập nhật bản sách, sinh phiếu phạt, đóng phiếu mượn nếu đã trả hết, giao bản cho người đặt trước.
DROP TRIGGER IF EXISTS trg_ctpm_au$$
CREATE TRIGGER trg_ctpm_au
AFTER UPDATE ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    IF OLD.ngay_tra IS NULL AND NEW.ngay_tra IS NOT NULL THEN
        SELECT nguoi_dung_id INTO v_nguoi_dung_id
        FROM phieu_muon
        WHERE id = NEW.phieu_muon_id;

        IF NEW.tinh_trang_tra = 'HU_HONG' THEN
            UPDATE ban_sach SET tinh_trang = 'HU_HONG' WHERE id = NEW.ban_sach_id;
        ELSEIF NEW.tinh_trang_tra = 'MAT' THEN
            UPDATE ban_sach SET tinh_trang = 'MAT' WHERE id = NEW.ban_sach_id;
        ELSE
            CALL sp_cap_phat_ban_sach(NEW.ban_sach_id);
        END IF;

        IF fn_so_ngay_qua_han(NEW.han_tra, NEW.ngay_tra) > 0 THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'QUA_HAN', fn_tien_phat_qua_han(NEW.han_tra, NEW.ngay_tra), 'Tra sach qua han');
        END IF;

        IF NEW.tinh_trang_tra = 'HU_HONG' THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'HU_HONG', fn_tham_so('PHAT_HU_HONG'), 'Sach hu hong khi tra');
        END IF;

        IF NEW.tinh_trang_tra = 'MAT' THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'MAT_SACH', fn_tien_phat_mat_sach(NEW.ban_sach_id), 'Mat sach');
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM ct_phieu_muon
            WHERE phieu_muon_id = NEW.phieu_muon_id
              AND ngay_tra IS NULL
        ) THEN
            UPDATE phieu_muon
            SET trang_thai = 'HOAN_TAT'
            WHERE id = NEW.phieu_muon_id;
        END IF;

        INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
        VALUES(v_nguoi_dung_id, 'TRA', 'CT_PHIEU_MUON', NEW.id, 'Tra sach');
    END IF;
END$$

-- Chỉ kiểm tra khi tạo lượt đặt đang hoạt động (chèn dữ liệu lịch sử DA_NHAN/HUY/HET_HAN thì bỏ qua).
-- Người đang bị chặn mượn (không hoạt động, giữ sách quá hạn, nợ phạt) cũng không được đặt trước,
-- tránh việc được giữ sách rồi không mượn nổi. Người đang mượn một bản của đầu sách thì không tự đặt trước đầu sách đó.
DROP TRIGGER IF EXISTS trg_dat_truoc_bi$$
CREATE TRIGGER trg_dat_truoc_bi
BEFORE INSERT ON dat_truoc
FOR EACH ROW
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_ly_do VARCHAR(100);

    IF NEW.trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN') THEN
        SET v_ly_do = fn_ly_do_khong_the_dat_truoc(NEW.nguoi_dung_id);
        IF v_ly_do IS NOT NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_ly_do;
        END IF;

        SELECT COUNT(*) INTO v_count
        FROM dat_truoc
        WHERE nguoi_dung_id = NEW.nguoi_dung_id
          AND sach_id = NEW.sach_id
          AND trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN');

        IF v_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Da co dat truoc dang hoat dong';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM ct_phieu_muon c
            JOIN phieu_muon p ON p.id = c.phieu_muon_id
            JOIN ban_sach b ON b.id = c.ban_sach_id
            WHERE p.nguoi_dung_id = NEW.nguoi_dung_id
              AND b.sach_id = NEW.sach_id
              AND c.ngay_tra IS NULL
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Dang muon dau sach nay, khong dat truoc duoc';
        END IF;
    END IF;
END$$

-- Phiếu phạt đã thanh toán/đã hủy là bất biến; khi thanh toán tự điền ngày.
DROP TRIGGER IF EXISTS trg_phieu_phat_bu$$
CREATE TRIGGER trg_phieu_phat_bu
BEFORE UPDATE ON phieu_phat
FOR EACH ROW
BEGIN
    IF OLD.trang_thai IN ('DA_THANH_TOAN','HUY')
       AND (NEW.trang_thai <> OLD.trang_thai OR NEW.so_tien <> OLD.so_tien) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu phat da thanh toan hoac da huy, khong duoc sua';
    END IF;

    IF OLD.trang_thai <> 'DA_THANH_TOAN' AND NEW.trang_thai = 'DA_THANH_TOAN' THEN
        SET NEW.ngay_thanh_toan = COALESCE(NEW.ngay_thanh_toan, CURDATE());
    END IF;
END$$

-- Tài khoản phải khớp loại người dùng (BAN_DOC cho SV/GV; ADMIN, THU_THU cho CAN_BO)
-- và không được HOAT_DONG khi người dùng đang bị tạm khóa/ngừng.
DROP TRIGGER IF EXISTS trg_tai_khoan_bi$$
CREATE TRIGGER trg_tai_khoan_bi
BEFORE INSERT ON tai_khoan
FOR EACH ROW
BEGIN
    DECLARE v_loai VARCHAR(20);
    DECLARE v_trang_thai VARCHAR(20);

    SELECT loai_nguoi_dung, trang_thai INTO v_loai, v_trang_thai
    FROM nguoi_dung
    WHERE id = NEW.nguoi_dung_id;

    IF (NEW.vai_tro = 'BAN_DOC' AND v_loai = 'CAN_BO')
       OR (NEW.vai_tro IN ('ADMIN','THU_THU') AND v_loai <> 'CAN_BO') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vai tro tai khoan khong phu hop loai nguoi dung';
    END IF;

    IF NEW.trang_thai = 'HOAT_DONG' AND v_trang_thai <> 'HOAT_DONG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong hoat dong, tai khoan phai o trang thai KHOA';
    END IF;
END$$

-- Khóa tài khoản hoặc đổi mật khẩu thì thu hồi mọi phiên đang mở (mở khóa lại không làm token cũ dùng lại được).
DROP TRIGGER IF EXISTS trg_tai_khoan_bu$$
CREATE TRIGGER trg_tai_khoan_bu
BEFORE UPDATE ON tai_khoan
FOR EACH ROW
BEGIN
    DECLARE v_loai VARCHAR(20);
    DECLARE v_trang_thai VARCHAR(20);

    SELECT loai_nguoi_dung, trang_thai INTO v_loai, v_trang_thai
    FROM nguoi_dung
    WHERE id = NEW.nguoi_dung_id;

    IF (NEW.vai_tro = 'BAN_DOC' AND v_loai = 'CAN_BO')
       OR (NEW.vai_tro IN ('ADMIN','THU_THU') AND v_loai <> 'CAN_BO') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vai tro tai khoan khong phu hop loai nguoi dung';
    END IF;

    IF NEW.trang_thai = 'HOAT_DONG' AND v_trang_thai <> 'HOAT_DONG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong hoat dong, tai khoan phai o trang thai KHOA';
    END IF;

    IF (NEW.trang_thai = 'KHOA' AND OLD.trang_thai <> 'KHOA') OR NEW.mat_khau_hash <> OLD.mat_khau_hash THEN
        UPDATE phien_dang_nhap SET da_dang_xuat = TRUE
        WHERE nguoi_dung_id = NEW.nguoi_dung_id AND da_dang_xuat = FALSE;
    END IF;
END$$

-- Người dùng bị tạm khóa/ngừng thì tài khoản bị KHOA theo. Chỉ đồng bộ chiều khóa: mở khóa người dùng KHÔNG tự mở
-- tài khoản, vì tài khoản có thể đang bị quản trị khóa riêng (lộ mật khẩu...); quản trị mở lại bằng UPDATE tai_khoan
-- (trg_tai_khoan_bu chỉ cho HOAT_DONG khi người dùng đã HOAT_DONG). Không cho đổi loại người dùng làm lệch vai trò.
DROP TRIGGER IF EXISTS trg_nguoi_dung_au$$
CREATE TRIGGER trg_nguoi_dung_au
AFTER UPDATE ON nguoi_dung
FOR EACH ROW
BEGIN
    IF NEW.loai_nguoi_dung <> OLD.loai_nguoi_dung AND EXISTS (
        SELECT 1
        FROM tai_khoan
        WHERE nguoi_dung_id = NEW.id
          AND ((vai_tro = 'BAN_DOC' AND NEW.loai_nguoi_dung = 'CAN_BO')
               OR (vai_tro IN ('ADMIN','THU_THU') AND NEW.loai_nguoi_dung <> 'CAN_BO'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Doi loai nguoi dung lam lech vai tro tai khoan';
    END IF;

    IF NOT (NEW.trang_thai <=> OLD.trang_thai) AND NEW.trang_thai <> 'HOAT_DONG' THEN
        UPDATE tai_khoan
        SET trang_thai = 'KHOA'
        WHERE nguoi_dung_id = NEW.id
          AND trang_thai <> 'KHOA';
    END IF;
END$$

DELIMITER ;

-- 08b. TẠO USER ĐĂNG NHẬP CSDL (tùy chọn, KHÔNG nằm trong 99_full_setup.sql)
-- Mật khẩu không được lưu trong repo. Đặt mật khẩu thật ở 3 dòng SET bên dưới (hoặc trước khi chạy file này),
-- rồi chạy file bằng tài khoản có quyền CREATE USER. Chưa đổi mật khẩu mẫu thì script tự dừng.
-- @user_host là máy được phép đăng nhập:
--   'localhost' khi MySQL cài thẳng trên máy và kết nối từ chính máy đó;
--   '%' khi MySQL chạy trong Docker: DBeaver/ứng dụng trên máy thật đi qua cổng 3306 của container nên MySQL
--   thấy địa chỉ của Docker chứ không phải localhost, user @'localhost' sẽ bị từ chối (lỗi 1045).
-- Cần chạy 08_security.sql trước để có sẵn role. Chạy lại file này sẽ ĐẶT LẠI mật khẩu cho user đã tồn tại
-- (kể cả 3 user cũ có mật khẩu ChangeMe_... từ bản trước) và gán lại role.

USE qltv_nhom8;

SET @pw_admin  = 'CHANGE_ME';
SET @pw_thuthu = 'CHANGE_ME';
SET @pw_bandoc = 'CHANGE_ME';
SET @user_host = 'localhost';

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_tmp_tao_user$$
CREATE PROCEDURE sp_tmp_tao_user()
BEGIN
    IF @pw_admin IS NULL OR @pw_thuthu IS NULL OR @pw_bandoc IS NULL
       OR @pw_admin = 'CHANGE_ME' OR @pw_thuthu = 'CHANGE_ME' OR @pw_bandoc = 'CHANGE_ME'
       OR CHAR_LENGTH(@pw_admin) < 12 OR CHAR_LENGTH(@pw_thuthu) < 12 OR CHAR_LENGTH(@pw_bandoc) < 12 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Hay dat 3 mat khau rieng (>= 12 ky tu) o dau file 08b_create_users.sql';
    END IF;
    IF @user_host IS NULL OR TRIM(@user_host) = '' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Hay dat @user_host (localhost hoac %) o dau file 08b_create_users.sql';
    END IF;

    SET @u_admin  = CONCAT('''qltv_admin''@', QUOTE(@user_host));
    SET @u_thuthu = CONCAT('''qltv_thuthu''@', QUOTE(@user_host));
    SET @u_bandoc = CONCAT('''qltv_bandoc''@', QUOTE(@user_host));

    SET @sql = CONCAT('CREATE USER IF NOT EXISTS ', @u_admin, ' IDENTIFIED BY ', QUOTE(@pw_admin));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('ALTER USER ', @u_admin, ' IDENTIFIED BY ', QUOTE(@pw_admin));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('GRANT ''r_qltv_admin'' TO ', @u_admin);
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('ALTER USER ', @u_admin, ' DEFAULT ROLE ''r_qltv_admin''');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

    SET @sql = CONCAT('CREATE USER IF NOT EXISTS ', @u_thuthu, ' IDENTIFIED BY ', QUOTE(@pw_thuthu));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('ALTER USER ', @u_thuthu, ' IDENTIFIED BY ', QUOTE(@pw_thuthu));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('GRANT ''r_qltv_thuthu'' TO ', @u_thuthu);
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('ALTER USER ', @u_thuthu, ' DEFAULT ROLE ''r_qltv_thuthu''');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

    SET @sql = CONCAT('CREATE USER IF NOT EXISTS ', @u_bandoc, ' IDENTIFIED BY ', QUOTE(@pw_bandoc));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('ALTER USER ', @u_bandoc, ' IDENTIFIED BY ', QUOTE(@pw_bandoc));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('GRANT ''r_qltv_bandoc'' TO ', @u_bandoc);
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('ALTER USER ', @u_bandoc, ' DEFAULT ROLE ''r_qltv_bandoc''');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
END$$

DELIMITER ;

CALL sp_tmp_tao_user();
DROP PROCEDURE sp_tmp_tao_user;

SET @pw_admin = NULL, @pw_thuthu = NULL, @pw_bandoc = NULL, @sql = NULL,
    @u_admin = NULL, @u_thuthu = NULL, @u_bandoc = NULL;

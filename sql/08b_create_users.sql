-- 08b. TẠO USER LOCAL (tùy chọn, KHÔNG nằm trong 99_full_setup.sql)
-- Mật khẩu không được lưu trong repo. Đặt mật khẩu thật ở 3 dòng SET bên dưới (hoặc trước khi chạy file này),
-- rồi chạy file bằng tài khoản có quyền CREATE USER. Chưa đổi mật khẩu mẫu thì script tự dừng.
-- Cần chạy 08_security.sql trước để có sẵn role. Chạy lại file này sẽ ĐẶT LẠI mật khẩu cho user đã tồn tại
-- (kể cả 3 user cũ có mật khẩu ChangeMe_... từ bản trước) và gán lại role.

USE qltv_nhom8;

SET @pw_admin  = 'CHANGE_ME';
SET @pw_thuthu = 'CHANGE_ME';
SET @pw_bandoc = 'CHANGE_ME';

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

    SET @sql = CONCAT('CREATE USER IF NOT EXISTS ''qltv_admin''@''localhost'' IDENTIFIED BY ', QUOTE(@pw_admin));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('ALTER USER ''qltv_admin''@''localhost'' IDENTIFIED BY ', QUOTE(@pw_admin));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

    SET @sql = CONCAT('CREATE USER IF NOT EXISTS ''qltv_thuthu''@''localhost'' IDENTIFIED BY ', QUOTE(@pw_thuthu));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('ALTER USER ''qltv_thuthu''@''localhost'' IDENTIFIED BY ', QUOTE(@pw_thuthu));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

    SET @sql = CONCAT('CREATE USER IF NOT EXISTS ''qltv_bandoc''@''localhost'' IDENTIFIED BY ', QUOTE(@pw_bandoc));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    SET @sql = CONCAT('ALTER USER ''qltv_bandoc''@''localhost'' IDENTIFIED BY ', QUOTE(@pw_bandoc));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
END$$

DELIMITER ;

CALL sp_tmp_tao_user();
DROP PROCEDURE sp_tmp_tao_user;

GRANT 'r_qltv_admin' TO 'qltv_admin'@'localhost';
GRANT 'r_qltv_thuthu' TO 'qltv_thuthu'@'localhost';
GRANT 'r_qltv_bandoc' TO 'qltv_bandoc'@'localhost';

SET DEFAULT ROLE ALL TO
    'qltv_admin'@'localhost',
    'qltv_thuthu'@'localhost',
    'qltv_bandoc'@'localhost';

SET @pw_admin = NULL, @pw_thuthu = NULL, @pw_bandoc = NULL, @sql = NULL;

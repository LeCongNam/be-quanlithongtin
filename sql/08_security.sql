USE qltv_nhom8;

-- 08. SECURITY
CREATE ROLE IF NOT EXISTS 'r_qltv_admin', 'r_qltv_thuthu', 'r_qltv_bandoc';

GRANT ALL PRIVILEGES ON qltv_nhom8.* TO 'r_qltv_admin';

GRANT SELECT, INSERT, UPDATE ON qltv_nhom8.* TO 'r_qltv_thuthu';
GRANT EXECUTE ON qltv_nhom8.* TO 'r_qltv_thuthu';

GRANT SELECT ON qltv_nhom8.vw_danh_muc_sach TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_dat_truoc TO 'r_qltv_bandoc';

CREATE USER IF NOT EXISTS 'qltv_admin'@'localhost' IDENTIFIED BY 'ChangeMe_Admin@2026';
CREATE USER IF NOT EXISTS 'qltv_thuthu'@'localhost' IDENTIFIED BY 'ChangeMe_ThuThu@2026';
CREATE USER IF NOT EXISTS 'qltv_bandoc'@'localhost' IDENTIFIED BY 'ChangeMe_BanDoc@2026';

GRANT 'r_qltv_admin' TO 'qltv_admin'@'localhost';
GRANT 'r_qltv_thuthu' TO 'qltv_thuthu'@'localhost';
GRANT 'r_qltv_bandoc' TO 'qltv_bandoc'@'localhost';

SET DEFAULT ROLE ALL TO
    'qltv_admin'@'localhost',
    'qltv_thuthu'@'localhost',
    'qltv_bandoc'@'localhost';

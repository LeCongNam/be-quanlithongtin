-- User kết nối của BE (NestJS/Prisma): quyền tối thiểu trên qltv_nhom8, không ALL PRIVILEGES.
-- * SELECT/INSERT/UPDATE/DELETE: Prisma đọc/ghi bảng và view.
-- * EXECUTE: gọi procedure/function nghiệp vụ (chạy với quyền DEFINER, nên không cần quyền trực tiếp
--   trên các bảng mà procedure đụng tới).
-- Không có CREATE/ALTER/DROP/INDEX/TRIGGER/EVENT/REFERENCES/GRANT OPTION: BE không đổi cấu trúc CSDL,
-- nên lộ DATABASE_URL hay lỗi trong BE cũng không xóa/sửa được schema.
--
-- File này nằm NGOÀI sql/ vì sql/ là bản sao của database_info (sync sẽ ghi đè).
-- docker-compose mount file này vào docker-entrypoint-initdb.d với tên 02_..., chạy SAU 01_full_setup.sql
-- (99_full_setup.sql drop và tạo lại DB nên user phải tạo sau nó). Chạy lại bằng root để áp cho DB đang chạy:
--   docker exec -i mysql_container mysql -uroot -prootpassword < docker/02_service_user.sql
-- Mật khẩu dưới đây là mật khẩu DEV (khớp .env.example); đổi cả hai khi dùng ngoài máy dev.

DROP USER IF EXISTS 'qltt'@'%';
CREATE USER 'qltt'@'%' IDENTIFIED BY 'qltt_password';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON qltv_nhom8.* TO 'qltt'@'%';

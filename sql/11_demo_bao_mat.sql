-- 11. DEMO XÁC THỰC VÀ PHÂN QUYỀN (KHÔNG nằm trong 99_full_setup.sql)
-- Điều kiện: đã nạp 99_full_setup.sql và chạy 08b_create_users.sql (MySQL trong Docker thì đặt @user_host = '%').
-- Mỗi phần chạy bằng một kết nối riêng (DBeaver: tạo 4 connection root / qltv_admin / qltv_thuthu / qltv_bandoc).
-- Chạy TỪNG CÂU (Ctrl+Enter), không chạy cả file: các câu ghi "-> lỗi ..." là cố ý bị chặn.
-- Không câu nào làm đổi dữ liệu nghiệp vụ, trừ sp_dang_nhap/sp_dang_xuat (thêm/đánh dấu 1 dòng phien_dang_nhap)
-- và câu UPDATE hợp lệ của thủ thư (nằm trong transaction rồi ROLLBACK).


-- =====================================================================
-- PHẦN 1. XÁC THỰC: đăng nhập CSDL bằng tài khoản MySQL
-- =====================================================================
-- 1a. Kết nối qltv_bandoc với mật khẩu SAI  -> lỗi 1045 Access denied (MySQL từ chối đăng nhập).
-- 1b. Kết nối đúng mật khẩu, rồi xem mình là ai và đang mang role nào:
SELECT CURRENT_USER() AS tai_khoan_mysql, CURRENT_ROLE() AS role_dang_dung;


-- =====================================================================
-- PHẦN 2. XEM PHÂN QUYỀN (kết nối root)
-- =====================================================================
SELECT user, host, account_locked FROM mysql.user
WHERE user LIKE 'qltv\_%' OR user LIKE 'r\_qltv\_%' ORDER BY user;    -- role là tài khoản bị khóa (account_locked = Y)

SELECT from_user AS role, to_user AS tai_khoan, to_host AS may FROM mysql.role_edges ORDER BY from_user;

SHOW GRANTS FOR 'r_qltv_admin';
SHOW GRANTS FOR 'r_qltv_thuthu';
SHOW GRANTS FOR 'r_qltv_bandoc';


-- =====================================================================
-- PHẦN 3. BẠN ĐỌC (kết nối qltv_bandoc)
-- =====================================================================
-- Được phép: xem danh mục sách qua view.
SELECT ma_sach, ten_sach, ten_the_loai, so_ban_san_sang FROM vw_danh_muc_sach LIMIT 5;

-- Bị chặn: đọc thẳng bảng.
SELECT * FROM nguoi_dung;                                  -- -> lỗi 1142 SELECT command denied
SELECT * FROM vw_lich_su_muon;                             -- -> lỗi 1142 (view chứa dữ liệu của mọi người)

-- Bị chặn: procedure nhận mã người dùng tùy ý (xem/hủy dữ liệu của người khác).
CALL sp_dat_truoc('SV005', 'S001');                        -- -> lỗi 1370 execute command denied

-- Xác thực từng bạn đọc: đăng nhập bằng tai_khoan (mật khẩu demo <MÃ>@Nhom8), nhận token phiên.
CALL sp_dang_nhap('sv002', 'sai_mat_khau', @token);         -- -> lỗi 1644 Ten dang nhap hoac mat khau khong dung
CALL sp_dang_nhap('sv002', 'SV002@Nhom8', @token);
CALL sp_bandoc_sach_dang_muon(@token);                     -- chỉ thấy sách của sv002
CALL sp_bandoc_tien_phat(@token);
CALL sp_bandoc_tien_phat('SV005');                         -- -> lỗi 1644: truyền mã thô thay token bị từ chối
CALL sp_dang_xuat(@token);
CALL sp_bandoc_sach_dang_muon(@token);                     -- -> lỗi 1644: token đã đăng xuất


-- =====================================================================
-- PHẦN 4. THỦ THƯ (kết nối qltv_thuthu)
-- =====================================================================
-- Được phép: xem báo cáo, đọc giao dịch.
SELECT * FROM vw_muon_qua_han;

-- Được phép: sửa thông tin liên hệ (thử rồi hoàn tác).
START TRANSACTION;
UPDATE nguoi_dung SET sdt = '0900000000' WHERE ma_nguoi_dung = 'SV002';
ROLLBACK;

-- Bị chặn theo CỘT: không tự đổi trạng thái (phải qua sp_doi_trang_thai_nguoi_dung), không đọc mật khẩu băm.
UPDATE nguoi_dung SET trang_thai = 'TAM_KHOA' WHERE ma_nguoi_dung = 'AD001';  -- -> lỗi 1143 UPDATE command denied ... column 'trang_thai'
SELECT ten_dang_nhap, mat_khau_hash FROM tai_khoan;        -- -> lỗi 1143 SELECT command denied ... column 'mat_khau_hash'
SELECT ten_dang_nhap, vai_tro, trang_thai FROM tai_khoan;  -- được (các cột còn lại)

-- Bị chặn theo THAO TÁC: không xóa danh mục, không ghi thẳng bảng giao dịch, không hủy phiếu phạt.
DELETE FROM the_loai WHERE ma_the_loai = 'TL15';           -- -> lỗi 1142 DELETE command denied
UPDATE phieu_phat SET trang_thai = 'DA_THANH_TOAN';                -- -> lỗi 1142 UPDATE command denied
CALL sp_huy_phat(1, 'thu');                                -- -> lỗi 1370 (chỉ quản trị)

-- Bị chặn: procedure thủ thư cũng không được đổi trạng thái cán bộ.
CALL sp_doi_trang_thai_nguoi_dung('AD001', 'TAM_KHOA');    -- -> lỗi 1644 Khong doi trang thai can bo qua thu tuc nay (chi quan tri)


-- =====================================================================
-- PHẦN 5. CẤP / THU HỒI QUYỀN (REVOKE rồi GRANT lại)
-- =====================================================================
-- 5a. (root) Thu hồi quyền xem báo cáo quá hạn của role thủ thư:
REVOKE SELECT ON qltv_nhom8.vw_muon_qua_han FROM 'r_qltv_thuthu';
SHOW GRANTS FOR 'r_qltv_thuthu';                           -- không còn dòng vw_muon_qua_han

-- 5b. (qltv_thuthu, kết nối đang mở) chạy lại:
SELECT * FROM vw_muon_qua_han;                             -- -> lỗi 1142: quyền mất ngay, không cần đăng nhập lại

-- 5c. (root) Cấp lại:
GRANT SELECT ON qltv_nhom8.vw_muon_qua_han TO 'r_qltv_thuthu';

-- 5d. (qltv_thuthu) chạy lại: xem được như cũ.
SELECT * FROM vw_muon_qua_han;

-- Ghi chú: MySQL không có DENY như SQL Server; "từ chối" một quyền = không GRANT hoặc REVOKE nó.
-- qltv_admin có ALL PRIVILEGES trên qltv_nhom8 nhưng không có GRANT OPTION, nên cấp/thu hồi quyền phải dùng root.

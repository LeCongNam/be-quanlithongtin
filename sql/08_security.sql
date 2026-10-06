USE qltv_nhom8;

-- 08. SECURITY (role và phân quyền; tạo user ở 08b_create_users.sql)
-- DROP DATABASE không thu hồi quyền đã cấp và CREATE ROLE IF NOT EXISTS giữ nguyên quyền cũ,
-- nên xóa role rồi tạo lại để mọi lần chạy đều cho ra đúng bộ quyền dưới đây (quyền thừa từ bản cũ bị gỡ).
-- Sau khi chạy file này, chạy lại 08b_create_users.sql để gán role cho user.
DROP ROLE IF EXISTS 'r_qltv_admin', 'r_qltv_thuthu', 'r_qltv_bandoc';
CREATE ROLE 'r_qltv_admin', 'r_qltv_thuthu', 'r_qltv_bandoc';

-- Quản trị: toàn quyền trên schema
GRANT ALL PRIVILEGES ON qltv_nhom8.* TO 'r_qltv_admin';

-- Thủ thư: nguyên tắc đặc quyền tối thiểu.
-- * Nghiệp vụ mượn/trả/gia hạn/đặt trước/thanh toán phạt đi qua procedure (chạy với quyền DEFINER),
--   nên thủ thư chỉ cần quyền ĐỌC trên các bảng giao dịch, không sửa trực tiếp được.
-- * Chỉ được ghi trực tiếp vào danh mục (sách, tác giả...), nhập bản sách/sửa vị trí kệ và thông tin liên hệ
--   của người dùng; đổi trạng thái người dùng qua sp_doi_trang_thai_nguoi_dung.
-- * Không đọc được muoi/mat_khau_hash, không sửa được tai_khoan, phieu_phat, nhat_ky_hanh_vi.
GRANT SELECT ON qltv_nhom8.tham_so TO 'r_qltv_thuthu';
GRANT SELECT, INSERT, UPDATE ON qltv_nhom8.the_loai TO 'r_qltv_thuthu';
GRANT SELECT, INSERT, UPDATE ON qltv_nhom8.nha_xuat_ban TO 'r_qltv_thuthu';
GRANT SELECT, INSERT, UPDATE ON qltv_nhom8.tac_gia TO 'r_qltv_thuthu';
GRANT SELECT, INSERT, UPDATE ON qltv_nhom8.sach TO 'r_qltv_thuthu';
GRANT SELECT, INSERT, UPDATE, DELETE ON qltv_nhom8.sach_tac_gia TO 'r_qltv_thuthu';
-- ban_sach: chỉ được nhập bản mới (tình trạng mặc định SAN_SANG, trigger tự giữ cho người đặt trước)
-- và sửa vị trí kệ. Đổi tinh_trang phải qua sp_cap_nhat_tinh_trang_ban_sach để không làm lệch dat_truoc.
GRANT SELECT ON qltv_nhom8.ban_sach TO 'r_qltv_thuthu';
GRANT INSERT (ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap) ON qltv_nhom8.ban_sach TO 'r_qltv_thuthu';
GRANT UPDATE (vi_tri_ke) ON qltv_nhom8.ban_sach TO 'r_qltv_thuthu';
-- nguoi_dung: thêm người dùng mới (trang_thai mặc định HOAT_DONG) và sửa thông tin liên hệ. Không UPDATE được
-- trang_thai/loai_nguoi_dung/ma_nguoi_dung: trước đây UPDATE cả bảng nên thủ thư khóa được AD001, trigger đồng bộ
-- (chạy quyền definer) khóa luôn tài khoản quản trị. Đổi trạng thái bạn đọc qua sp_doi_trang_thai_nguoi_dung.
GRANT SELECT ON qltv_nhom8.nguoi_dung TO 'r_qltv_thuthu';
GRANT INSERT (ma_nguoi_dung, ho_ten, loai_nguoi_dung, email, sdt, khoa_don_vi) ON qltv_nhom8.nguoi_dung TO 'r_qltv_thuthu';
GRANT UPDATE (ho_ten, email, sdt, khoa_don_vi) ON qltv_nhom8.nguoi_dung TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.phieu_muon TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.ct_phieu_muon TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.phieu_phat TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.dat_truoc TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.nhat_ky_hanh_vi TO 'r_qltv_thuthu';
GRANT SELECT (id, nguoi_dung_id, ten_dang_nhap, vai_tro, trang_thai, created_at)
    ON qltv_nhom8.tai_khoan TO 'r_qltv_thuthu';

GRANT SELECT ON qltv_nhom8.vw_danh_muc_sach TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.vw_sach_dang_muon TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.vw_muon_qua_han TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.vw_nguoi_dung_vi_pham TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.vw_top_sach_muon_nhieu TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.vw_tra_cuu_sach TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.vw_thong_ke_tien_phat TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.vw_lich_su_muon TO 'r_qltv_thuthu';
GRANT SELECT ON qltv_nhom8.vw_dat_truoc TO 'r_qltv_thuthu';

GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_tao_phieu_muon TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_them_sach_vao_phieu TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_huy_phieu_muon TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_tra_sach TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_gia_han TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_dat_truoc TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_huy_dat_truoc TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_thanh_toan_phat TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_cap_nhat_tinh_trang_ban_sach TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_them_sach TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_them_ban_sach TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_doi_trang_thai_nguoi_dung TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_tra_cuu_sach TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_cursor_danh_dau_qua_han TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_cursor_het_han_dat_truoc TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_cursor_thong_ke_muon_theo_nguoi_dung TO 'r_qltv_thuthu';

-- sp_huy_phat (hủy phiếu phạt) không cấp cho thủ thư: chỉ quản trị (ALL PRIVILEGES) dùng được.
-- sp_gia_han_luot_muon là phần lõi nội bộ của sp_gia_han/sp_bandoc_gia_han, không cấp cho vai trò nào.

-- Bạn đọc: chỉ tra cứu, đặt/hủy đặt trước, tự gia hạn, xem sách đang mượn, lịch sử mượn, lượt đặt trước và tiền phạt
-- của mình. Không SELECT thẳng vw_lich_su_muon/vw_dat_truoc (chứa dữ liệu mọi người) mà đọc qua procedure nhận token.
-- Đây là tài khoản MySQL dùng chung cho tầng ứng dụng nên CSDL không tự biết ai đang gọi. Để bạn đọc này không xem/hủy
-- dữ liệu của bạn đọc khác (IDOR), bạn đọc KHÔNG có EXECUTE trên các procedure nhận mã người dùng hoặc mã bản sách của
-- bất kỳ ai (sp_dat_truoc, sp_huy_dat_truoc, sp_tra_cuu_sach, sp_gia_han); chỉ đăng nhập bằng sp_dang_nhap rồi dùng
-- các procedure nhận token (CSDL suy ra người dùng từ token). Bảng phien_dang_nhap và sp_xac_thuc_phien (nội bộ) không
-- cấp cho vai trò nào ngoài quản trị.
GRANT SELECT ON qltv_nhom8.vw_danh_muc_sach TO 'r_qltv_bandoc';
GRANT SELECT ON qltv_nhom8.vw_tra_cuu_sach TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_dang_nhap TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_dang_xuat TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_bandoc_tra_cuu TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_bandoc_dat_truoc TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_bandoc_huy_dat_truoc TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_bandoc_sach_dang_muon TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_bandoc_tien_phat TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_bandoc_gia_han TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_bandoc_lich_su_muon TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_bandoc_ds_dat_truoc TO 'r_qltv_bandoc';

USE qltv_nhom8;

-- 09. SMOKE TEST (không nằm trong 99_full_setup.sql; chạy sau khi dựng xong DB)
-- Phần A-C chỉ đọc. Phần D chạy kịch bản mượn/trả/đặt trước với SET autocommit = 0 rồi ROLLBACK,
-- nên chạy lại nhiều lần không làm đổi dữ liệu mẫu. Không thay bằng START TRANSACTION: procedure tự mở
-- transaction sẽ ngầm COMMIT phần trước đó (xem quy ước transaction ở đầu 04_procedures.sql).
-- Nếu công cụ (vd. TablePlus) cắt sai câu lệnh khi Import, hãy mở file này trong SQL Editor và Run All.

-- A. Số lượng dữ liệu và đối tượng (kỳ vọng: 15 bảng, 9 view, 9 function, 30 procedure, 12 trigger, 3 event)
SELECT
    (SELECT COUNT(*) FROM information_schema.tables   WHERE table_schema = 'qltv_nhom8' AND table_type = 'BASE TABLE') AS so_bang,
    (SELECT COUNT(*) FROM information_schema.views    WHERE table_schema = 'qltv_nhom8') AS so_view,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'qltv_nhom8' AND routine_type = 'FUNCTION') AS so_function,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'qltv_nhom8' AND routine_type = 'PROCEDURE') AS so_procedure,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'qltv_nhom8') AS so_trigger,
    (SELECT COUNT(*) FROM information_schema.events   WHERE event_schema = 'qltv_nhom8') AS so_event;

SELECT COUNT(*) AS so_the_loai FROM the_loai;
SELECT COUNT(*) AS so_sach FROM sach;
SELECT COUNT(*) AS so_ban_sach FROM ban_sach;
SELECT COUNT(*) AS so_nguoi_dung FROM nguoi_dung;
SELECT * FROM tham_so;

-- B. Báo cáo
SELECT * FROM vw_danh_muc_sach ORDER BY ma_sach;
SELECT * FROM vw_sach_dang_muon;
SELECT * FROM vw_muon_qua_han;
SELECT * FROM vw_nguoi_dung_vi_pham;
SELECT * FROM vw_top_sach_muon_nhieu LIMIT 10;
SELECT * FROM vw_thong_ke_tien_phat ORDER BY thang, loai_phat;
SELECT * FROM vw_dat_truoc WHERE trang_thai IN ('CHO_XU_LY', 'SAN_SANG_NHAN') ORDER BY ma_sach, thu_tu_cho;  -- S004: SV007 NULL (đang tạm khóa, không xếp hàng), GV002 thứ 1
SELECT * FROM vw_lich_su_muon WHERE ma_nguoi_dung = 'SV001' ORDER BY ngay_muon DESC;   -- kỳ vọng 2 dòng: BS001 đang mượn, BS019 đã MAT
CALL sp_tra_cuu_sach('Tanenbaum', 'SV004');   -- kỳ vọng 3 dòng: S006, S008, S015 (khớp theo tác giả)
CALL sp_tra_cuu_sach('cơ sở', 'SV004');       -- kỳ vọng 2 dòng: S001, S002 (âm tiết 2 ký tự; không dấu 'co so' cũng vậy)
CALL sp_tra_cuu_sach('IT', 'SV004');          -- kỳ vọng 3 dòng: S007, S011, S013 (từ ngắn; khớp chuỗi con nên S007 'Security' cũng ra)
CALL sp_tra_cuu_sach('%', 'SV004');           -- kỳ vọng 0 dòng: % là ký tự thường, không phải ký tự đại diện
CALL sp_tra_cuu_sach('', 'SV004');            -- kỳ vọng 0 dòng và không ghi nhật ký

-- C. Function (kỳ vọng: 3 ngày; 15000; SV004 bị chặn vì giữ sách quá hạn; SV002 được mượn = NULL)
SELECT fn_so_ngay_qua_han(DATE_SUB(CURDATE(), INTERVAL 3 DAY), CURDATE()) AS test_so_ngay_qua_han;
SELECT fn_tien_phat_qua_han(DATE_SUB(CURDATE(), INTERVAL 3 DAY), CURDATE()) AS test_tien_phat;
SELECT fn_ly_do_khong_the_muon((SELECT id FROM nguoi_dung WHERE ma_nguoi_dung = 'SV004')) AS ly_do_sv004;
SELECT fn_ly_do_khong_the_muon((SELECT id FROM nguoi_dung WHERE ma_nguoi_dung = 'SV002')) AS ly_do_sv002;

CALL sp_cursor_thong_ke_muon_theo_nguoi_dung();

-- D. Kịch bản nghiệp vụ (ROLLBACK ở cuối)
SET autocommit = 0;

-- D1. Mượn -> gia hạn -> trả bình thường: phiếu tự chuyển HOAN_TAT (kỳ vọng DANG_MUON rồi HOAN_TAT)
CALL sp_tao_phieu_muon('SV002', 'CB001', @ma_phieu);
CALL sp_them_sach_vao_phieu(@ma_phieu, 'BS002');
SELECT * FROM vw_sach_dang_muon WHERE ma_phieu = @ma_phieu;
CALL sp_gia_han('BS002', 7);
SELECT trang_thai AS trang_thai_phieu_truoc_khi_tra FROM phieu_muon WHERE ma_phieu = @ma_phieu;
CALL sp_tra_sach('BS002', 'BINH_THUONG');
SELECT trang_thai AS trang_thai_phieu_sau_khi_tra FROM phieu_muon WHERE ma_phieu = @ma_phieu;

-- D2. Trả sách quá hạn của SV004 (BS006, quá hạn 4 ngày): đúng 1 phiếu QUA_HAN 20.000đ.
--     SV007 và GV002 đang chờ sách này (S004). SV007 đặt sớm hơn nhưng đang bị tạm khóa (không mượn được)
--     nên bị bỏ qua: bản được giữ cho GV002, lượt đặt của SV007 vẫn CHO_XU_LY.
CALL sp_tra_sach('BS006', 'BINH_THUONG');
SELECT loai_phat, so_tien FROM phieu_phat WHERE ct_phieu_muon_id = 4;
SELECT ma_ban_sach, tinh_trang FROM ban_sach WHERE ma_ban_sach = 'BS006';
SELECT nd.ma_nguoi_dung, d.trang_thai, d.ban_sach_id, d.han_giu
FROM dat_truoc d JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
WHERE d.sach_id = (SELECT id FROM sach WHERE ma_sach = 'S004') AND d.trang_thai IN ('CHO_XU_LY', 'SAN_SANG_NHAN');

-- D3. Thanh toán phạt của SV005 (phiếu phạt 3): SV005 hết bị chặn mượn (kỳ vọng ly_do = NULL)
CALL sp_thanh_toan_phat(3);
SELECT fn_ly_do_khong_the_muon((SELECT id FROM nguoi_dung WHERE ma_nguoi_dung = 'SV005')) AS ly_do_sv005_sau_khi_tra_phat;

-- D4. Sửa bản sách hỏng BS010 (S008): SV002 đang chờ nên bản được giữ cho SV002
CALL sp_dat_truoc('SV002', 'S008');
CALL sp_cap_nhat_tinh_trang_ban_sach('BS010', 'SAN_SANG');
SELECT ma_ban_sach, tinh_trang FROM ban_sach WHERE ma_ban_sach = 'BS010';

-- D5. Nhập bản sách mới cho S004: người còn chờ chỉ có SV007 (đang tạm khóa) nên bản mới SAN_SANG, không giữ
--     cho người không mượn được (kỳ vọng truy vấn thứ hai rỗng). Nhánh giữ bản mới cho người đủ điều kiện: test L9d.
INSERT INTO ban_sach (ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap)
VALUES ('BS099', (SELECT id FROM sach WHERE ma_sach = 'S004'), 'A2-02', CURDATE());
SELECT ma_ban_sach, tinh_trang FROM ban_sach WHERE ma_ban_sach = 'BS099';
SELECT nd.ma_nguoi_dung, d.trang_thai, d.han_giu
FROM dat_truoc d JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
WHERE d.ban_sach_id = (SELECT id FROM ban_sach WHERE ma_ban_sach = 'BS099');

-- D6. Phiếu rỗng, mất sách theo giá bìa, hủy phạt, đồng bộ tài khoản.
CALL sp_tao_phieu_muon('SV003', 'CB001', @ma_phieu_rong);
CALL sp_huy_phieu_muon(@ma_phieu_rong);
SELECT trang_thai AS trang_thai_phieu_rong FROM phieu_muon WHERE ma_phieu = @ma_phieu_rong;   -- kỳ vọng HUY

UPDATE sach SET gia_bia = 400000 WHERE ma_sach = 'S001';
CALL sp_tao_phieu_muon('SV003', 'CB001', @ma_phieu_mat);
CALL sp_them_sach_vao_phieu(@ma_phieu_mat, 'BS002');
CALL sp_tra_sach('BS002', 'MAT');
SELECT loai_phat, so_tien FROM phieu_phat WHERE ct_phieu_muon_id = (SELECT MAX(id) FROM ct_phieu_muon);  -- kỳ vọng MAT_SACH 400000 (giá bìa > 300000)

CALL sp_huy_phat(6, 'Lap nham phieu phat');
SELECT trang_thai, ly_do FROM phieu_phat WHERE id = 6;                                        -- kỳ vọng HUY

UPDATE nguoi_dung SET trang_thai = 'TAM_KHOA' WHERE ma_nguoi_dung = 'SV003';
SELECT trang_thai AS tai_khoan_sv003_sau_khi_khoa FROM tai_khoan WHERE ten_dang_nhap = 'sv003';  -- kỳ vọng KHOA

-- D7. Bạn đọc SV002 đăng nhập, xem lịch sử mượn và lượt đặt trước, tự gia hạn BS003 (đang mượn, hạn còn 9 ngày)
CALL sp_dang_nhap('sv002', 'SV002@Nhom8', @tok_sv002);
CALL sp_bandoc_lich_su_muon(@tok_sv002);    -- kỳ vọng 3 dòng: phiếu D1 (BS002 đã trả), PM000002 (BS003), PM000011 (BS012)
CALL sp_bandoc_ds_dat_truoc(@tok_sv002);    -- kỳ vọng 2 dòng: S008 SAN_SANG_NHAN giữ BS010 (D4), S006 CHO_XU_LY thứ 1
CALL sp_bandoc_gia_han(@tok_sv002, 'BS003', 7);
SELECT DATEDIFF(han_tra, CURDATE()) AS so_ngay_con_lai_bs003, so_lan_gia_han   -- kỳ vọng 16 và 1
FROM ct_phieu_muon WHERE ban_sach_id = (SELECT id FROM ban_sach WHERE ma_ban_sach = 'BS003') AND ngay_tra IS NULL;

-- D8. Thêm đầu sách mới kèm 2 tác giả rồi nhập 2 bản: mã tự sinh BS100, BS101 (BS099 đã nhập ở D5), SAN_SANG
CALL sp_them_sach('S099', '9786040000990', 'Phân tích thiết kế hệ thống', 'TL01', 'NXB01', 2025, NULL, 135000,
                  'PTTK', 'TG01,TG02');
CALL sp_them_ban_sach('S099', 2, 'D1-01');
SELECT * FROM vw_tra_cuu_sach WHERE ma_sach = 'S099';   -- kỳ vọng 2 tác giả, so_ban_san_sang = 2

ROLLBACK;
SET autocommit = 1;

-- E. Các lời gọi dưới đây được thiết kế để BÁO LỖI. Bỏ dấu -- ở MỘT dòng mỗi lần để xem thông báo.
-- CALL sp_tao_phieu_muon('SV001', 'CB001', @x);   -- SV001: giữ sách quá hạn / còn nợ phạt
-- CALL sp_tao_phieu_muon('SV007', 'CB001', @x);   -- SV007: đang tạm khóa
-- CALL sp_gia_han('BS006', 7);                    -- sách đã quá hạn
-- CALL sp_dat_truoc('SV002', 'S001');             -- S001 còn bản sẵn sàng
-- CALL sp_dat_truoc('SV002', 'S002');             -- (khi S002 hết bản) SV002 đang mượn BS003 của S002 nên không tự đặt trước
-- CALL sp_tra_sach('BS002', 'BINH_THUONG');       -- BS002 không có lượt mượn đang mở
-- CALL sp_dat_truoc('SV005', 'S001');             -- (khi S001 hết bản) SV005 còn nợ phạt nên bị chặn đặt trước
-- UPDATE tai_khoan SET vai_tro = 'ADMIN' WHERE ten_dang_nhap = 'sv001';   -- vai trò không phù hợp loại người dùng
-- CALL sp_them_sach('S001', NULL, 'Trung ma', 'TL01', 'NXB01', NULL, NULL, NULL, NULL, NULL);   -- mã sách đã tồn tại
-- CALL sp_them_sach('S098', NULL, 'Sach moi', 'TL01', 'NXB01', NULL, NULL, NULL, NULL, 'TG01,TG99');   -- TG99 không tồn tại
-- CALL sp_dang_nhap('sv002', 'SV002@Nhom8', @tok);
-- CALL sp_bandoc_gia_han(@tok, 'BS001', 7);       -- BS001 do SV001 mượn: SV002 không gia hạn được (báo như không có lượt mượn)
-- INSERT INTO ban_sach (ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap, tinh_trang)
--     VALUES ('BS098', 1, 'A1-01', CURDATE(), 'DANG_MUON');   -- không được nhập bản sách ở trạng thái đang mượn

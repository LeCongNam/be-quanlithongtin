USE qltv_nhom8;

-- 10. REGRESSION TEST cho các lỗi đã sửa (docs/05, mục #40 trở đi). Không nằm trong 99_full_setup.sql.
-- Tự kiểm tra: in bảng PASS/FAIL, nếu có FAIL thì dòng cuối báo lỗi (client dừng với mã lỗi khác 0).
-- File này GHI THẬT vào CSDL (các procedure tự COMMIT), nên chỉ chạy trên CSDL vừa cài từ 99_full_setup.sql,
-- trước khi chạy 09_smoke_test.sql. Muốn chạy lại thì cài lại 99_full_setup.sql.

DROP TEMPORARY TABLE IF EXISTS tmp_ket_qua_test;
CREATE TEMPORARY TABLE tmp_ket_qua_test (
    stt INT AUTO_INCREMENT PRIMARY KEY,
    ma_test VARCHAR(20) NOT NULL,
    mo_ta VARCHAR(255) NOT NULL,
    ket_qua CHAR(4) NOT NULL
);

DELIMITER $$

-- p_dat = NULL cũng tính là FAIL
DROP PROCEDURE IF EXISTS t_kiem_tra$$
CREATE PROCEDURE t_kiem_tra(IN p_ma VARCHAR(20), IN p_dat BOOLEAN, IN p_mo_ta VARCHAR(255))
BEGIN
    INSERT INTO tmp_ket_qua_test(ma_test, mo_ta, ket_qua)
    VALUES(p_ma, p_mo_ta, IF(p_dat, 'PASS', 'FAIL'));
END$$

DROP PROCEDURE IF EXISTS t_ket_luan$$
CREATE PROCEDURE t_ket_luan()
BEGIN
    DECLARE v_so_fail INT;
    DECLARE v_thong_bao VARCHAR(128);

    SELECT COUNT(*) INTO v_so_fail FROM tmp_ket_qua_test WHERE ket_qua = 'FAIL';
    IF v_so_fail > 0 THEN
        SET v_thong_bao = CONCAT('Regression test: ', v_so_fail, ' kiem tra FAIL');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_thong_bao;
    END IF;
END$$

-- L1 (#40): procedure ghi dữ liệu phải nguyên tử. Lỗi giữa chừng (ở đây: thiếu tham số SO_NGAY_GIU_DAT_TRUOC
-- khi giao bản sách cho người kế tiếp) thì mọi thay đổi trước đó phải được hoàn tác.
DROP PROCEDURE IF EXISTS t_l1$$
CREATE PROCEDURE t_l1()
BEGIN
    DECLARE v_loi INT DEFAULT 0;
    DECLARE v_gia_tri DECIMAL(12,2);
    DECLARE v_don_vi VARCHAR(20);
    DECLARE v_mo_ta VARCHAR(255);
    DECLARE v_cb_id BIGINT;
    DECLARE v_gia_id BIGINT;
    DECLARE v_so_phieu_truoc INT;
    DECLARE v_so_dat_truoc INT;

    SELECT gia_tri, don_vi, mo_ta INTO v_gia_tri, v_don_vi, v_mo_ta
    FROM tham_so WHERE ma_tham_so = 'SO_NGAY_GIU_DAT_TRUOC';

    -- L1a. GV001 đang được giữ BS012 (S010); SV002 xếp hàng sau. Hủy lượt của GV001 khi thiếu tham số.
    CALL sp_dat_truoc('SV002', 'S010');
    DELETE FROM tham_so WHERE ma_tham_so = 'SO_NGAY_GIU_DAT_TRUOC';
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_loi = 1;
        CALL sp_huy_dat_truoc('GV001', 'S010');
    END;
    INSERT INTO tham_so(ma_tham_so, gia_tri, don_vi, mo_ta)
    VALUES('SO_NGAY_GIU_DAT_TRUOC', v_gia_tri, v_don_vi, v_mo_ta);

    CALL t_kiem_tra('L1a', v_loi = 1, 'sp_huy_dat_truoc bao loi khi thieu tham so');
    CALL t_kiem_tra('L1a', (SELECT d.trang_thai FROM dat_truoc d
                            JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
                            JOIN sach s ON s.id = d.sach_id
                            WHERE nd.ma_nguoi_dung = 'GV001' AND s.ma_sach = 'S010'
                            ORDER BY d.id DESC LIMIT 1) = 'SAN_SANG_NHAN',
                    'Luot dat cua GV001 van SAN_SANG_NHAN (khong bi doi sang HUY)');
    CALL t_kiem_tra('L1a', (SELECT tinh_trang FROM ban_sach WHERE ma_ban_sach = 'BS012') = 'DANG_GIU',
                    'BS012 van DANG_GIU va con nguoi giu');
    CALL t_kiem_tra('L1a', (SELECT COUNT(*) FROM dat_truoc
                            WHERE ban_sach_id = (SELECT id FROM ban_sach WHERE ma_ban_sach = 'BS012')
                              AND trang_thai = 'SAN_SANG_NHAN') = 1,
                    'BS012 co dung 1 luot dat SAN_SANG_NHAN tro toi');

    -- L1b. sp_tao_phieu_muon: INSERT thành công nhưng UPDATE ma_phieu lỗi (trùng mã) thì không được để lại phiếu.
    -- Chèn sẵn một phiếu chiếm trước mã mà procedure sẽ sinh ra cho dòng kế tiếp.
    SELECT id INTO v_cb_id FROM nguoi_dung WHERE ma_nguoi_dung = 'CB001';
    INSERT INTO phieu_muon(nguoi_dung_id, nhan_vien_id, ngay_muon, trang_thai)
    VALUES(v_cb_id, v_cb_id, CURDATE(), 'HUY');
    SET v_gia_id = LAST_INSERT_ID();
    UPDATE phieu_muon SET ma_phieu = CONCAT('PM', LPAD(v_gia_id + 1, 6, '0')) WHERE id = v_gia_id;
    SELECT COUNT(*) INTO v_so_phieu_truoc FROM phieu_muon;

    SET v_loi = 0;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_loi = 1;
        CALL sp_tao_phieu_muon('SV002', 'CB001', @t_ma_phieu);
    END;
    DELETE FROM phieu_muon WHERE id = v_gia_id;

    CALL t_kiem_tra('L1b', v_loi = 1, 'sp_tao_phieu_muon bao loi khi ma phieu bi trung');
    CALL t_kiem_tra('L1b', (SELECT COUNT(*) FROM phieu_muon) = v_so_phieu_truoc - 1,
                    'Khong con phieu muon mo coi (ma_phieu NULL) sau khi loi');

    -- L1c. Event giữ sách hết hạn: lỗi khi giao bản cho người kế tiếp thì lượt đó phải giữ nguyên,
    -- không được để lượt đặt HET_HAN còn bản sách kẹt ở DANG_GIU. Sau khi có lại tham số thì xử lý bình thường.
    UPDATE dat_truoc SET han_giu = NOW() - INTERVAL 1 HOUR
    WHERE trang_thai = 'SAN_SANG_NHAN'
      AND ban_sach_id = (SELECT id FROM ban_sach WHERE ma_ban_sach = 'BS012');

    DELETE FROM tham_so WHERE ma_tham_so = 'SO_NGAY_GIU_DAT_TRUOC';
    SET v_loi = 0;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_loi = 1;
        CALL sp_cursor_het_han_dat_truoc();
    END;
    INSERT INTO tham_so(ma_tham_so, gia_tri, don_vi, mo_ta)
    VALUES('SO_NGAY_GIU_DAT_TRUOC', v_gia_tri, v_don_vi, v_mo_ta);

    CALL t_kiem_tra('L1c', v_loi = 1, 'sp_cursor_het_han_dat_truoc bao loi (khong im lang nuot loi)');
    CALL t_kiem_tra('L1c', (SELECT COUNT(*) FROM dat_truoc
                            WHERE ban_sach_id = (SELECT id FROM ban_sach WHERE ma_ban_sach = 'BS012')
                              AND trang_thai = 'SAN_SANG_NHAN') = 1,
                    'Luot giu BS012 duoc giu nguyen khi xu ly loi');

    CALL sp_cursor_het_han_dat_truoc();
    CALL t_kiem_tra('L1c', (SELECT nd.ma_nguoi_dung FROM dat_truoc d
                            JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
                            WHERE d.ban_sach_id = (SELECT id FROM ban_sach WHERE ma_ban_sach = 'BS012')
                              AND d.trang_thai = 'SAN_SANG_NHAN') = 'SV002',
                    'Co lai tham so: BS012 chuyen sang giu cho SV002');
    SELECT COUNT(*) INTO v_so_dat_truoc FROM dat_truoc d
    JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
    WHERE nd.ma_nguoi_dung = 'GV001' AND d.trang_thai = 'HET_HAN'
      AND d.sach_id = (SELECT id FROM sach WHERE ma_sach = 'S010');
    CALL t_kiem_tra('L1c', v_so_dat_truoc = 1, 'Luot giu cua GV001 chuyen HET_HAN');

    -- L1d. Bên gọi tự quản lý transaction (autocommit = 0): procedure không tự COMMIT, ROLLBACK của bên gọi hủy được.
    SELECT COUNT(*) INTO v_so_phieu_truoc FROM phieu_muon;
    SET autocommit = 0;
    CALL sp_tao_phieu_muon('SV002', 'CB001', @t_ma_phieu);
    ROLLBACK;
    SET autocommit = 1;
    CALL t_kiem_tra('L1d', (SELECT COUNT(*) FROM phieu_muon) = v_so_phieu_truoc,
                    'autocommit = 0: ROLLBACK cua ben goi huy phieu vua lap');

    -- L1e. Ở chế độ đó, procedure lỗi thì cả transaction của bên gọi bị hoàn tác, kể cả khi bên gọi lỡ COMMIT.
    SET v_loi = 0;
    SET autocommit = 0;
    CALL sp_tao_phieu_muon('SV002', 'CB001', @t_ma_phieu);
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_loi = 1;
        CALL sp_tra_sach('BS_KHONG_TON_TAI', 'BINH_THUONG');
    END;
    COMMIT;
    SET autocommit = 1;
    CALL t_kiem_tra('L1e', v_loi = 1, 'sp_tra_sach bao loi ban sach khong co luot muon');
    CALL t_kiem_tra('L1e', (SELECT COUNT(*) FROM phieu_muon) = v_so_phieu_truoc,
                    'Phieu lap truoc do trong cung transaction cung bi hoan tac');
END$$

-- L2 (#41): thủ thư không được đổi trạng thái/loại người dùng trực tiếp (trước đây UPDATE cả bảng nguoi_dung
-- nên khóa được AD001 và trigger khóa luôn tài khoản quản trị). Đổi trạng thái phải qua sp_doi_trang_thai_nguoi_dung,
-- procedure này từ chối đối tượng là cán bộ.
-- Quyền được kiểm tra qua information_schema/mysql.procs_priv (file chạy bằng root); thử bằng user thật xem docs/05.
DROP PROCEDURE IF EXISTS t_l2$$
CREATE PROCEDURE t_l2()
BEGIN
    DECLARE v_loi INT DEFAULT 0;

    CALL t_kiem_tra('L2a', NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE grantee = '''r_qltv_thuthu''@''%''' AND table_schema = 'qltv_nhom8'
              AND table_name = 'nguoi_dung' AND privilege_type IN ('INSERT','UPDATE')),
        'Role thu thu khong co INSERT/UPDATE ca bang nguoi_dung');
    CALL t_kiem_tra('L2a', (SELECT GROUP_CONCAT(column_name ORDER BY column_name)
                            FROM information_schema.column_privileges
                            WHERE grantee = '''r_qltv_thuthu''@''%''' AND table_schema = 'qltv_nhom8'
                              AND table_name = 'nguoi_dung' AND privilege_type = 'UPDATE')
                           = 'email,ho_ten,khoa_don_vi,sdt',
        'Role thu thu chi UPDATE duoc ho_ten, email, sdt, khoa_don_vi');
    CALL t_kiem_tra('L2a', NOT EXISTS (
            SELECT 1 FROM information_schema.column_privileges
            WHERE grantee = '''r_qltv_thuthu''@''%''' AND table_schema = 'qltv_nhom8'
              AND table_name = 'nguoi_dung' AND privilege_type = 'INSERT'
              AND column_name IN ('id','trang_thai','created_at')),
        'Role thu thu khong INSERT duoc trang_thai (nguoi moi luon HOAT_DONG)');
    CALL t_kiem_tra('L2a', EXISTS (
            SELECT 1 FROM mysql.procs_priv
            WHERE user = 'r_qltv_thuthu' AND db = 'qltv_nhom8'
              AND routine_name = 'sp_doi_trang_thai_nguoi_dung' AND FIND_IN_SET('Execute', proc_priv)),
        'Role thu thu duoc goi sp_doi_trang_thai_nguoi_dung');

    -- L2b. Không khóa được cán bộ (quản trị hay thủ thư khác) qua procedure
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_loi = 1;
        CALL sp_doi_trang_thai_nguoi_dung('AD001', 'TAM_KHOA');
    END;
    CALL t_kiem_tra('L2b', v_loi = 1, 'sp_doi_trang_thai_nguoi_dung tu choi doi tuong CAN_BO');
    CALL t_kiem_tra('L2b', (SELECT trang_thai FROM nguoi_dung WHERE ma_nguoi_dung = 'AD001') = 'HOAT_DONG'
                       AND (SELECT trang_thai FROM tai_khoan WHERE ten_dang_nhap = 'ad001') = 'HOAT_DONG',
                    'AD001 va tai khoan ad001 van HOAT_DONG');

    SET v_loi = 0;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_loi = 1;
        CALL sp_doi_trang_thai_nguoi_dung('SV006', 'BI_KHOA');
    END;
    CALL t_kiem_tra('L2b', v_loi = 1, 'Trang thai khong hop le bi tu choi');

    -- L2c. Bạn đọc thì khóa được; tài khoản bị khóa theo và có nhật ký
    SET v_loi = 0;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_loi = 1;
        CALL sp_doi_trang_thai_nguoi_dung('SV006', 'TAM_KHOA');
    END;
    CALL t_kiem_tra('L2c', v_loi = 0, 'sp_doi_trang_thai_nguoi_dung khoa duoc ban doc');
    CALL t_kiem_tra('L2c', (SELECT trang_thai FROM nguoi_dung WHERE ma_nguoi_dung = 'SV006') = 'TAM_KHOA'
                       AND (SELECT trang_thai FROM tai_khoan WHERE ten_dang_nhap = 'sv006') = 'KHOA',
                    'Khoa SV006: nguoi dung TAM_KHOA, tai khoan KHOA');
    CALL t_kiem_tra('L2c', EXISTS (
            SELECT 1 FROM nhat_ky_hanh_vi
            WHERE loai_hanh_vi = 'DOI_TRANG_THAI_ND' AND doi_tuong = 'NGUOI_DUNG'
              AND doi_tuong_id = (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung = 'SV006')
              AND mo_ta = 'HOAT_DONG -> TAM_KHOA'),
        'Co nhat ky DOI_TRANG_THAI_ND cho SV006');
END$$

-- L3 (#42): mở khóa người dùng không được tự mở lại tài khoản. Trước đây trigger đồng bộ hai chiều nên tài khoản
-- bị quản trị khóa riêng (vd. lộ mật khẩu) tự HOAT_DONG lại khi người dùng hết tạm khóa.
DROP PROCEDURE IF EXISTS t_l3$$
CREATE PROCEDURE t_l3()
BEGIN
    DECLARE v_loi INT DEFAULT 0;

    -- L3a. Tài khoản sv008 bị khóa riêng; người dùng bị tạm khóa rồi mở lại -> tài khoản vẫn KHOA
    UPDATE tai_khoan SET trang_thai = 'KHOA' WHERE ten_dang_nhap = 'sv008';
    UPDATE nguoi_dung SET trang_thai = 'TAM_KHOA' WHERE ma_nguoi_dung = 'SV008';
    UPDATE nguoi_dung SET trang_thai = 'HOAT_DONG' WHERE ma_nguoi_dung = 'SV008';
    CALL t_kiem_tra('L3a', (SELECT trang_thai FROM tai_khoan WHERE ten_dang_nhap = 'sv008') = 'KHOA',
                    'Tai khoan bi khoa rieng khong tu mo lai khi mo khoa nguoi dung');

    -- L3b. Chiều khóa vẫn đồng bộ: NGUNG cũng khóa tài khoản
    UPDATE nguoi_dung SET trang_thai = 'NGUNG' WHERE ma_nguoi_dung = 'SV003';
    CALL t_kiem_tra('L3b', (SELECT trang_thai FROM tai_khoan WHERE ten_dang_nhap = 'sv003') = 'KHOA',
                    'Nguoi dung NGUNG thi tai khoan bi KHOA');

    -- L3c. Mở lại tài khoản là thao tác riêng: bị chặn khi người dùng còn khóa, được phép khi đã mở khóa
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_loi = 1;
        UPDATE tai_khoan SET trang_thai = 'HOAT_DONG' WHERE ten_dang_nhap = 'sv003';
    END;
    CALL t_kiem_tra('L3c', v_loi = 1, 'Khong mo duoc tai khoan khi nguoi dung con NGUNG');

    UPDATE nguoi_dung SET trang_thai = 'HOAT_DONG' WHERE ma_nguoi_dung = 'SV003';
    CALL t_kiem_tra('L3c', (SELECT trang_thai FROM tai_khoan WHERE ten_dang_nhap = 'sv003') = 'KHOA',
                    'Mo khoa nguoi dung: tai khoan van KHOA cho quan tri mo rieng');
    UPDATE tai_khoan SET trang_thai = 'HOAT_DONG' WHERE ten_dang_nhap = 'sv003';
    CALL t_kiem_tra('L3c', (SELECT trang_thai FROM tai_khoan WHERE ten_dang_nhap = 'sv003') = 'HOAT_DONG',
                    'Quan tri mo lai tai khoan sv003 duoc');
END$$

-- L4 (#43): thêm sách vào phiếu lập từ ngày trước thì han_tra bị tính từ ngày lập phiếu (phiếu lập 5 ngày trước chỉ
-- còn 9 ngày). Từ nay chỉ thêm sách vào phiếu lập hôm nay. Mỗi kịch bản chạy trong transaction của bên gọi rồi ROLLBACK;
-- giá trị cần kiểm tra được lấy ra trước ROLLBACK (bảng tạm của InnoDB cũng bị hoàn tác theo).
DROP PROCEDURE IF EXISTS t_l4$$
CREATE PROCEDURE t_l4()
BEGIN
    DECLARE v_loi INT DEFAULT 0;
    DECLARE v_thong_bao VARCHAR(128) DEFAULT '';
    DECLARE v_so_ct_truoc INT;
    DECLARE v_so_ct_sau INT;
    DECLARE v_tt_ban_sach VARCHAR(20);
    DECLARE v_han_tra DATE;
    DECLARE v_han_mong_doi DATE;

    -- L4a. PM000002 lập 5 ngày trước (DANG_MUON): từ chối, không ghi lượt mượn, bản sách không đổi
    SELECT COUNT(*) INTO v_so_ct_truoc FROM ct_phieu_muon;
    SET autocommit = 0;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1 v_loi = MYSQL_ERRNO, v_thong_bao = MESSAGE_TEXT;
        CALL sp_them_sach_vao_phieu('PM000002', 'BS002');
    END;
    SELECT COUNT(*) INTO v_so_ct_sau FROM ct_phieu_muon;
    SELECT tinh_trang INTO v_tt_ban_sach FROM ban_sach WHERE ma_ban_sach = 'BS002';
    ROLLBACK;
    SET autocommit = 1;
    CALL t_kiem_tra('L4a', v_loi <> 0, 'Them sach vao phieu lap tu ngay truoc bi tu choi');
    CALL t_kiem_tra('L4a', v_thong_bao LIKE '%phieu moi%', 'Thong bao huong dan lap phieu moi');
    CALL t_kiem_tra('L4a', v_so_ct_sau = v_so_ct_truoc, 'Khong ghi luot muon nao');
    CALL t_kiem_tra('L4a', v_tt_ban_sach = 'SAN_SANG', 'BS002 van SAN_SANG');

    -- L4b. Phiếu lập hôm nay: han_tra = hôm nay + SO_NGAY_MUON (14), thêm nhiều sách vẫn cùng hạn
    SET v_han_mong_doi = DATE_ADD(CURDATE(), INTERVAL fn_tham_so('SO_NGAY_MUON') DAY);
    SET autocommit = 0;
    CALL sp_tao_phieu_muon('SV002', 'CB001', @t_ma_phieu);
    CALL sp_them_sach_vao_phieu(@t_ma_phieu, 'BS002');
    SELECT c.han_tra INTO v_han_tra
    FROM ct_phieu_muon c JOIN ban_sach b ON b.id = c.ban_sach_id
    WHERE b.ma_ban_sach = 'BS002' AND c.ngay_tra IS NULL;
    ROLLBACK;
    SET autocommit = 1;
    CALL t_kiem_tra('L4b', v_han_tra = v_han_mong_doi, 'Phieu lap hom nay: han_tra = hom nay + SO_NGAY_MUON');
    CALL t_kiem_tra('L4b', v_han_tra = DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'Voi tham so mau: han_tra = hom nay + 14');
END$$

-- L5 (#44): lượt đặt trước "ma". Người đang CHO_XU_LY (bị bỏ qua lúc tạm khóa) mượn thẳng bản SAN_SANG thì lượt đặt
-- vẫn mở; khi trả sách, bản lại được giữ cho chính họ. Nếu họ đang giữ một bản KHÁC thì bản đó bị giữ vô ích.
DROP PROCEDURE IF EXISTS t_l5$$
CREATE PROCEDURE t_l5()
BEGIN
    DECLARE v_tt_truoc VARCHAR(20);
    DECLARE v_tt_dt VARCHAR(20);
    DECLARE v_so_hoat_dong INT;
    DECLARE v_ban_nhan VARCHAR(30);
    DECLARE v_tt_b1 VARCHAR(20);
    DECLARE v_tt_b2 VARCHAR(20);
    DECLARE v_nguoi_giu_b1 VARCHAR(20);
    DECLARE v_so_giu INT;
    DECLARE v_sach_id BIGINT;
    DECLARE v_sv003 BIGINT;

    SELECT id INTO v_sach_id FROM sach WHERE ma_sach = 'S006';
    SELECT id INTO v_sv003 FROM nguoi_dung WHERE ma_nguoi_dung = 'SV003';

    -- L5a. SV002 đang chờ S006 nhưng bị tạm khóa lúc nhập bản mới nên bị bỏ qua (bản SAN_SANG);
    -- mở khóa rồi SV002 mượn thẳng bản đó: lượt đặt phải hoàn tất (DA_NHAN) và ghi bản đã nhận
    SET autocommit = 0;
    UPDATE nguoi_dung SET trang_thai = 'TAM_KHOA' WHERE ma_nguoi_dung = 'SV002';
    INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap)
    VALUES('BS_T5A', v_sach_id, 'T-01', CURDATE());
    SELECT tinh_trang INTO v_tt_truoc FROM ban_sach WHERE ma_ban_sach = 'BS_T5A';
    UPDATE nguoi_dung SET trang_thai = 'HOAT_DONG' WHERE ma_nguoi_dung = 'SV002';
    CALL sp_tao_phieu_muon('SV002', 'CB001', @t_ma_phieu);
    CALL sp_them_sach_vao_phieu(@t_ma_phieu, 'BS_T5A');
    SELECT d.trang_thai, b.ma_ban_sach INTO v_tt_dt, v_ban_nhan
    FROM dat_truoc d LEFT JOIN ban_sach b ON b.id = d.ban_sach_id
    WHERE d.nguoi_dung_id = (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung = 'SV002') AND d.sach_id = v_sach_id
    ORDER BY d.id DESC LIMIT 1;
    SELECT COUNT(*) INTO v_so_hoat_dong FROM dat_truoc
    WHERE sach_id = v_sach_id AND trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN');
    ROLLBACK;
    SET autocommit = 1;
    CALL t_kiem_tra('L5a', v_tt_truoc = 'SAN_SANG', 'Tien de: nguoi cho bi tam khoa bi bo qua, ban moi SAN_SANG');
    CALL t_kiem_tra('L5a', v_tt_dt = 'DA_NHAN', 'Muon thang ban SAN_SANG: luot dat truoc cua nguoi muon thanh DA_NHAN');
    CALL t_kiem_tra('L5a', v_ban_nhan = 'BS_T5A', 'Luot dat truoc ghi dung ban sach da nhan');
    CALL t_kiem_tra('L5a', v_so_hoat_dong = 0, 'Khong con luot dat truoc ma cho S006');

    -- L5b. SV002 đang được giữ bản B1, SV003 xếp hàng sau; SV002 mượn thẳng bản B2 (SAN_SANG):
    -- lượt của SV002 hoàn tất và bản B1 chuyển cho SV003, không bị giữ vô ích
    SET autocommit = 0;
    INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap) VALUES('BS_T5B1', v_sach_id, 'T-01', CURDATE());
    INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap) VALUES('BS_T5B2', v_sach_id, 'T-01', CURDATE());
    SELECT tinh_trang INTO v_tt_truoc FROM ban_sach WHERE ma_ban_sach = 'BS_T5B2';
    INSERT INTO dat_truoc(nguoi_dung_id, sach_id, han_giu, trang_thai) VALUES(v_sv003, v_sach_id, NULL, 'CHO_XU_LY');
    CALL sp_tao_phieu_muon('SV002', 'CB001', @t_ma_phieu);
    CALL sp_them_sach_vao_phieu(@t_ma_phieu, 'BS_T5B2');
    SELECT d.trang_thai INTO v_tt_dt
    FROM dat_truoc d
    WHERE d.nguoi_dung_id = (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung = 'SV002') AND d.sach_id = v_sach_id
    ORDER BY d.id DESC LIMIT 1;
    SELECT tinh_trang INTO v_tt_b1 FROM ban_sach WHERE ma_ban_sach = 'BS_T5B1';
    SELECT nd.ma_nguoi_dung INTO v_nguoi_giu_b1
    FROM dat_truoc d JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
    WHERE d.ban_sach_id = (SELECT id FROM ban_sach WHERE ma_ban_sach = 'BS_T5B1') AND d.trang_thai = 'SAN_SANG_NHAN';
    SELECT COUNT(*) INTO v_so_giu FROM dat_truoc WHERE sach_id = v_sach_id AND trang_thai = 'SAN_SANG_NHAN';
    ROLLBACK;
    SET autocommit = 1;
    CALL t_kiem_tra('L5b', v_tt_truoc = 'SAN_SANG', 'Tien de: B2 nhap sau khi het nguoi cho nen SAN_SANG');
    CALL t_kiem_tra('L5b', v_tt_dt = 'DA_NHAN', 'SV002 muon B2: luot dat truoc cua SV002 thanh DA_NHAN');
    CALL t_kiem_tra('L5b', v_tt_b1 = 'DANG_GIU' AND v_nguoi_giu_b1 = 'SV003', 'B1 duoc chuyen cho nguoi ke tiep (SV003)');
    CALL t_kiem_tra('L5b', v_so_giu = 1, 'Chi con dung 1 ban dang giu cho S006');

    -- L5c. Như L5b nhưng không còn ai chờ: bản B1 trả về SAN_SANG
    SET autocommit = 0;
    INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap) VALUES('BS_T5C1', v_sach_id, 'T-01', CURDATE());
    INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap) VALUES('BS_T5C2', v_sach_id, 'T-01', CURDATE());
    CALL sp_tao_phieu_muon('SV002', 'CB001', @t_ma_phieu);
    CALL sp_them_sach_vao_phieu(@t_ma_phieu, 'BS_T5C2');
    SELECT tinh_trang INTO v_tt_b1 FROM ban_sach WHERE ma_ban_sach = 'BS_T5C1';
    SELECT tinh_trang INTO v_tt_b2 FROM ban_sach WHERE ma_ban_sach = 'BS_T5C2';
    SELECT COUNT(*) INTO v_so_giu FROM dat_truoc WHERE sach_id = v_sach_id AND trang_thai = 'SAN_SANG_NHAN';
    ROLLBACK;
    SET autocommit = 1;
    CALL t_kiem_tra('L5c', v_tt_b1 = 'SAN_SANG' AND v_so_giu = 0, 'Khong con ai cho: ban dang giu tra ve SAN_SANG');
    CALL t_kiem_tra('L5c', v_tt_b2 = 'DANG_MUON', 'Ban muon thang chuyen DANG_MUON');

    -- L5d. Luồng thường không đổi: mượn đúng bản đang giữ cho mình -> DA_NHAN (bản đó DANG_MUON, không ai khác bị động)
    SET autocommit = 0;
    INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap) VALUES('BS_T5D1', v_sach_id, 'T-01', CURDATE());
    INSERT INTO dat_truoc(nguoi_dung_id, sach_id, han_giu, trang_thai) VALUES(v_sv003, v_sach_id, NULL, 'CHO_XU_LY');
    CALL sp_tao_phieu_muon('SV002', 'CB001', @t_ma_phieu);
    CALL sp_them_sach_vao_phieu(@t_ma_phieu, 'BS_T5D1');
    SELECT d.trang_thai, b.ma_ban_sach INTO v_tt_dt, v_ban_nhan
    FROM dat_truoc d LEFT JOIN ban_sach b ON b.id = d.ban_sach_id
    WHERE d.nguoi_dung_id = (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung = 'SV002') AND d.sach_id = v_sach_id
    ORDER BY d.id DESC LIMIT 1;
    SELECT d.trang_thai INTO v_tt_b1 FROM dat_truoc d WHERE d.nguoi_dung_id = v_sv003 AND d.sach_id = v_sach_id
    ORDER BY d.id DESC LIMIT 1;
    ROLLBACK;
    SET autocommit = 1;
    CALL t_kiem_tra('L5d', v_tt_dt = 'DA_NHAN' AND v_ban_nhan = 'BS_T5D1', 'Muon dung ban dang giu: DA_NHAN');
    CALL t_kiem_tra('L5d', v_tt_b1 = 'CHO_XU_LY', 'Nguoi cho khac (SV003) khong bi dong toi');
END$$

-- L6 (#45): dat_truoc.ban_sach_id chỉ ràng buộc tới ban_sach(id) nên trỏ được tới bản của đầu sách khác.
-- Khóa ngoại ghép (ban_sach_id, sach_id) -> ban_sach(id, sach_id) buộc bản được giữ phải cùng đầu sách với lượt đặt.
DROP PROCEDURE IF EXISTS t_l6$$
CREATE PROCEDURE t_l6()
BEGIN
    DECLARE v_loi INT DEFAULT 0;

    -- L6a. Chèn lượt đặt S002 nhưng ghi bản BS001 (thuộc S001)
    SET autocommit = 0;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION GET DIAGNOSTICS CONDITION 1 v_loi = MYSQL_ERRNO;
        INSERT INTO dat_truoc(nguoi_dung_id, sach_id, ban_sach_id, trang_thai)
        VALUES((SELECT id FROM nguoi_dung WHERE ma_nguoi_dung = 'SV003'),
               (SELECT id FROM sach WHERE ma_sach = 'S002'),
               (SELECT id FROM ban_sach WHERE ma_ban_sach = 'BS001'), 'HUY');
    END;
    ROLLBACK;
    SET autocommit = 1;
    CALL t_kiem_tra('L6a', v_loi = 1452, 'INSERT dat_truoc voi ban sach cua dau sach khac bi loi 1452');

    -- L6b. Sửa lượt giữ BS012 (S010) sang bản BS001 (S001)
    SET v_loi = 0;
    SET autocommit = 0;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION GET DIAGNOSTICS CONDITION 1 v_loi = MYSQL_ERRNO;
        UPDATE dat_truoc SET ban_sach_id = (SELECT id FROM ban_sach WHERE ma_ban_sach = 'BS001')
        WHERE id = 5;
    END;
    ROLLBACK;
    SET autocommit = 1;
    CALL t_kiem_tra('L6b', v_loi = 1452, 'UPDATE dat_truoc sang ban sach cua dau sach khac bi loi 1452');

    -- L6c. Bản đúng đầu sách vẫn ghi được; không ghi bản (NULL) vẫn ghi được
    SET v_loi = 0;
    SET autocommit = 0;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION GET DIAGNOSTICS CONDITION 1 v_loi = MYSQL_ERRNO;
        INSERT INTO dat_truoc(nguoi_dung_id, sach_id, ban_sach_id, trang_thai)
        VALUES((SELECT id FROM nguoi_dung WHERE ma_nguoi_dung = 'SV003'),
               (SELECT id FROM sach WHERE ma_sach = 'S001'),
               (SELECT id FROM ban_sach WHERE ma_ban_sach = 'BS001'), 'HUY');
        INSERT INTO dat_truoc(nguoi_dung_id, sach_id, ban_sach_id, trang_thai)
        VALUES((SELECT id FROM nguoi_dung WHERE ma_nguoi_dung = 'SV003'),
               (SELECT id FROM sach WHERE ma_sach = 'S002'), NULL, 'HUY');
    END;
    ROLLBACK;
    SET autocommit = 1;
    CALL t_kiem_tra('L6c', v_loi = 0, 'Ban sach dung dau sach, hoac NULL, van ghi duoc');

    -- L6d. Khóa ngoại ghép đúng 2 cột
    CALL t_kiem_tra('L6d', (SELECT GROUP_CONCAT(column_name ORDER BY ordinal_position)
                            FROM information_schema.key_column_usage
                            WHERE table_schema = 'qltv_nhom8' AND table_name = 'dat_truoc'
                              AND constraint_name = 'fk_dt_ban_sach') = 'ban_sach_id,sach_id',
                    'fk_dt_ban_sach la khoa ngoai ghep (ban_sach_id, sach_id)');
END$$

-- Hai hàm trợ giúp cho t_l7: chạy một câu lệnh động và trả về mã lỗi/thông báo (không dừng test khi câu lệnh lỗi,
-- kể cả khi procedure/hàm chưa tồn tại), hoặc tính một biểu thức và trả NULL nếu nó lỗi (NULL tính là FAIL).
DROP PROCEDURE IF EXISTS t_chay$$
CREATE PROCEDURE t_chay(IN p_lenh TEXT, OUT p_errno INT, OUT p_msg VARCHAR(512))
BEGIN
    DECLARE v_e INT;
    DECLARE v_m VARCHAR(512);
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_e = MYSQL_ERRNO, v_m = MESSAGE_TEXT;
        IF p_errno = 0 THEN
            SET p_errno = v_e, p_msg = v_m;
        END IF;
    END;
    SET p_errno = 0, p_msg = '';
    SET @t_lenh = p_lenh;
    PREPARE t_stmt FROM @t_lenh;
    EXECUTE t_stmt;
    DEALLOCATE PREPARE t_stmt;
END$$

DROP PROCEDURE IF EXISTS t_gia_tri$$
CREATE PROCEDURE t_gia_tri(IN p_bieu_thuc TEXT)
BEGIN
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
    SET @t_kq = NULL;
    SET @t_lenh = CONCAT('SET @t_kq = ', p_bieu_thuc);
    PREPARE t_stmt FROM @t_lenh;
    EXECUTE t_stmt;
    DEALLOCATE PREPARE t_stmt;
END$$

-- L7 (#46): IDOR bạn đọc. Bạn đọc dùng chung một user MySQL nên mọi procedure nhận "mã người dùng" tùy ý: gọi
-- sp_bandoc_tien_phat('SV005') xem được phạt của người khác, sp_huy_dat_truoc hủy được lượt đặt của người khác.
-- Sửa: đăng nhập bằng sp_dang_nhap lấy token phiên (CSDL chỉ lưu SHA-256), các procedure dành cho bạn đọc nhận token.
-- Test chạy với autocommit = 1 trên dữ liệu thử riêng (T7A, T7B, S_T7), dọn sạch ở cuối.
DROP PROCEDURE IF EXISTS t_l7$$
CREATE PROCEDURE t_l7()
BEGIN
    DECLARE v_loi INT;
    DECLARE v_msg VARCHAR(512);
    DECLARE v_loi2 INT;
    DECLARE v_msg2 VARCHAR(512);

    INSERT INTO nguoi_dung(ma_nguoi_dung, ho_ten, loai_nguoi_dung, email)
    VALUES('T7A', 'Test L7 A', 'SINH_VIEN', 't7a@test.vn'), ('T7B', 'Test L7 B', 'SINH_VIEN', 't7b@test.vn');
    INSERT INTO tai_khoan(nguoi_dung_id, ten_dang_nhap, muoi, mat_khau_hash, vai_tro)
    SELECT id, LOWER(ma_nguoi_dung), REPEAT('a', 32), SHA2(CONCAT(REPEAT('a', 32), 'Mk_Test_7'), 256), 'BAN_DOC'
    FROM nguoi_dung WHERE ma_nguoi_dung IN ('T7A', 'T7B');
    -- đầu sách chưa có bản nào: đặt trước được ngay
    INSERT INTO sach(ma_sach, ten_sach, the_loai_id, nxb_id)
    VALUES('S_T7', 'Sach thu L7', (SELECT MIN(id) FROM the_loai), (SELECT MIN(id) FROM nha_xuat_ban));

    -- L7a. Đăng nhập: đúng mật khẩu nhận token ngẫu nhiên, CSDL chỉ lưu băm; sai thông tin thì báo lỗi chung
    SET @t7_a = NULL, @t7_a2 = NULL, @t7_b = NULL, @t7_b2 = NULL, @t7_x = NULL;
    CALL t_chay("CALL sp_dang_nhap('t7a', 'Mk_Test_7', @t7_a)", v_loi, v_msg);
    CALL t_kiem_tra('L7a', v_loi = 0 AND @t7_a REGEXP '^[0-9a-f]{64}$', 'Dang nhap dung mat khau: nhan token 64 ky tu thap luc phan');
    CALL t_chay("CALL sp_dang_nhap('t7a', 'Mk_Test_7', @t7_a2)", v_loi, v_msg);
    CALL t_kiem_tra('L7a', @t7_a2 <> @t7_a, 'Moi lan dang nhap nhan mot token khac');
    CALL t_gia_tri('(SELECT COUNT(*) FROM phien_dang_nhap WHERE token_hash IN (@t7_a, @t7_a2))');
    CALL t_kiem_tra('L7a', @t_kq = '0', 'CSDL khong luu token ro');
    CALL t_gia_tri('(SELECT COUNT(*) FROM phien_dang_nhap WHERE token_hash IN (SHA2(@t7_a, 256), SHA2(@t7_a2, 256)))');
    CALL t_kiem_tra('L7a', @t_kq = '2', 'CSDL chi luu SHA-256 cua token');
    CALL t_gia_tri("(SELECT TIMESTAMPDIFF(MINUTE, NOW(), het_han) - fn_tham_so('SO_GIO_PHIEN') * 60 BETWEEN -2 AND 0
                     FROM phien_dang_nhap WHERE token_hash = SHA2(@t7_a, 256))");
    CALL t_kiem_tra('L7a', @t_kq = '1', 'Phien het han sau SO_GIO_PHIEN gio');

    CALL t_chay("CALL sp_dang_nhap('t7a', 'sai_mat_khau', @t7_x)", v_loi, v_msg);
    CALL t_chay("CALL sp_dang_nhap('khong_ton_tai', 'Mk_Test_7', @t7_x)", v_loi2, v_msg2);
    CALL t_kiem_tra('L7a', v_loi = 1644 AND v_msg LIKE 'Ten dang nhap%', 'Sai mat khau bi tu choi');
    CALL t_kiem_tra('L7a', v_loi2 = 1644 AND v_msg2 = v_msg, 'Sai ten dang nhap bao cung thong bao (khong lo tai khoan co ton tai)');
    -- sv007 đang tạm khóa (tài khoản KHOA): đúng mật khẩu vẫn không vào được
    CALL t_chay("CALL sp_dang_nhap('sv007', 'SV007@Nhom8', @t7_x)", v_loi, v_msg);
    CALL t_kiem_tra('L7a', v_loi = 1644 AND v_msg = v_msg2 AND @t7_x IS NULL, 'Tai khoan bi khoa khong dang nhap duoc, khong co token');

    -- L7b. Token -> mã người dùng; mã thô, token giả, băm lưu trong CSDL, rỗng đều không hợp lệ
    CALL t_chay("CALL sp_dang_nhap('t7b', 'Mk_Test_7', @t7_b)", v_loi, v_msg);
    CALL t_gia_tri('fn_nguoi_dung_tu_token(@t7_a)');
    CALL t_kiem_tra('L7b', @t_kq = 'T7A', 'Token cua T7A cho ra T7A');
    CALL t_gia_tri('fn_nguoi_dung_tu_token(@t7_b)');
    CALL t_kiem_tra('L7b', @t_kq = 'T7B', 'Token cua T7B cho ra T7B');
    CALL t_gia_tri("COALESCE(fn_nguoi_dung_tu_token('T7A'), 'KHONG')");
    CALL t_kiem_tra('L7b', @t_kq = 'KHONG', 'Ma nguoi dung tho khong phai token');
    CALL t_gia_tri("COALESCE(fn_nguoi_dung_tu_token(REPEAT('0', 64)), 'KHONG')");
    CALL t_kiem_tra('L7b', @t_kq = 'KHONG', 'Token gia khong hop le');
    CALL t_gia_tri("COALESCE(fn_nguoi_dung_tu_token(SHA2(@t7_a, 256)), 'KHONG')");
    CALL t_kiem_tra('L7b', @t_kq = 'KHONG', 'Gia tri bam luu trong CSDL khong dung lam token duoc');
    CALL t_gia_tri("COALESCE(fn_nguoi_dung_tu_token(NULL), 'KHONG')");
    CALL t_kiem_tra('L7b', @t_kq = 'KHONG', 'Token NULL khong hop le');

    -- L7c. IDOR: không còn truyền mã người dùng tùy ý; mỗi bạn đọc chỉ thao tác trên dữ liệu của chính mình
    CALL t_chay("CALL sp_bandoc_tien_phat('SV005')", v_loi, v_msg);
    CALL t_kiem_tra('L7c', v_loi = 1644 AND v_msg LIKE 'Phien dang nhap%', 'sp_bandoc_tien_phat tu choi ma nguoi dung tho (xem phat nguoi khac)');
    CALL t_chay("CALL sp_bandoc_sach_dang_muon('SV004')", v_loi, v_msg);
    CALL t_kiem_tra('L7c', v_loi = 1644 AND v_msg LIKE 'Phien dang nhap%', 'sp_bandoc_sach_dang_muon tu choi ma nguoi dung tho');
    CALL t_chay("CALL sp_bandoc_tra_cuu('SV005', 'abc')", v_loi, v_msg);
    CALL t_kiem_tra('L7c', v_loi = 1644 AND v_msg LIKE 'Phien dang nhap%', 'sp_bandoc_tra_cuu tu choi ma nguoi dung tho (ghi nhat ky gia)');
    CALL t_chay('CALL sp_bandoc_tien_phat(@t7_a)', v_loi, v_msg);
    CALL t_kiem_tra('L7c', v_loi = 0, 'sp_bandoc_tien_phat voi token hop le chay duoc');
    CALL t_chay('CALL sp_bandoc_sach_dang_muon(@t7_a)', v_loi, v_msg);
    CALL t_kiem_tra('L7c', v_loi = 0, 'sp_bandoc_sach_dang_muon voi token hop le chay duoc');

    CALL t_chay("CALL sp_bandoc_dat_truoc(@t7_a, 'S_T7')", v_loi, v_msg);
    CALL t_kiem_tra('L7c', v_loi = 0 AND (SELECT COUNT(*) FROM dat_truoc d
                            JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id JOIN sach s ON s.id = d.sach_id
                            WHERE s.ma_sach = 'S_T7' AND nd.ma_nguoi_dung = 'T7A' AND d.trang_thai = 'CHO_XU_LY') = 1,
                    'Dat truoc bang token: luot dat ghi cho dung chu token (T7A)');
    CALL t_kiem_tra('L7c', (SELECT COUNT(*) FROM dat_truoc d JOIN sach s ON s.id = d.sach_id
                            WHERE s.ma_sach = 'S_T7') = 1, 'Khong phat sinh luot dat cho nguoi khac');

    CALL t_chay("CALL sp_bandoc_huy_dat_truoc(@t7_b, 'S_T7')", v_loi, v_msg);
    CALL t_kiem_tra('L7c', v_loi = 1644 AND v_msg LIKE 'Khong co luot dat truoc%', 'T7B khong huy duoc luot dat cua T7A');
    CALL t_kiem_tra('L7c', (SELECT d.trang_thai FROM dat_truoc d JOIN sach s ON s.id = d.sach_id
                            WHERE s.ma_sach = 'S_T7') = 'CHO_XU_LY', 'Luot dat cua T7A van CHO_XU_LY');
    CALL t_chay("CALL sp_bandoc_huy_dat_truoc(@t7_a, 'S_T7')", v_loi, v_msg);
    CALL t_kiem_tra('L7c', v_loi = 0 AND (SELECT d.trang_thai FROM dat_truoc d JOIN sach s ON s.id = d.sach_id
                            WHERE s.ma_sach = 'S_T7') = 'HUY', 'Chu token huy duoc luot dat cua minh');

    CALL t_chay("CALL sp_bandoc_tra_cuu(@t7_a, 'Sach thu L7')", v_loi, v_msg);
    CALL t_kiem_tra('L7c', v_loi = 0 AND EXISTS (
            SELECT 1 FROM nhat_ky_hanh_vi k JOIN nguoi_dung nd ON nd.id = k.nguoi_dung_id
            WHERE nd.ma_nguoi_dung = 'T7A' AND k.loai_hanh_vi = 'TRA_CUU' AND k.mo_ta = 'Tra cuu: Sach thu L7'),
        'Tra cuu bang token: nhat ky TRA_CUU ghi dung chu token');

    -- L7d. Đăng xuất, hết hạn, khóa tài khoản làm token mất hiệu lực; event dọn phiên cũ
    CALL t_chay('CALL sp_dang_xuat(@t7_a)', v_loi, v_msg);
    CALL t_kiem_tra('L7d', v_loi = 0, 'sp_dang_xuat chay duoc');
    CALL t_gia_tri("COALESCE(fn_nguoi_dung_tu_token(@t7_a), 'KHONG')");
    CALL t_kiem_tra('L7d', @t_kq = 'KHONG', 'Token da dang xuat khong dung duoc nua');
    CALL t_chay("CALL sp_bandoc_dat_truoc(@t7_a, 'S_T7')", v_loi, v_msg);
    CALL t_kiem_tra('L7d', v_loi = 1644 AND v_msg LIKE 'Phien dang nhap%', 'Procedure bao loi phien voi token da dang xuat');
    CALL t_gia_tri('fn_nguoi_dung_tu_token(@t7_a2)');
    CALL t_kiem_tra('L7d', @t_kq = 'T7A', 'Dang xuat mot phien khong anh huong phien khac cua T7A');
    CALL t_chay("CALL sp_dang_xuat('khong_ton_tai')", v_loi, v_msg);
    CALL t_kiem_tra('L7d', v_loi = 0, 'Dang xuat token la khong bao loi (khong lo token co ton tai)');

    CALL t_chay('UPDATE phien_dang_nhap SET het_han = NOW() - INTERVAL 1 MINUTE WHERE token_hash = SHA2(@t7_b, 256)', v_loi, v_msg);
    CALL t_gia_tri("COALESCE(fn_nguoi_dung_tu_token(@t7_b), 'KHONG')");
    CALL t_kiem_tra('L7d', v_loi = 0 AND @t_kq = 'KHONG', 'Token qua han het hieu luc');

    CALL t_chay("CALL sp_dang_nhap('t7b', 'Mk_Test_7', @t7_b2)", v_loi, v_msg);
    UPDATE nguoi_dung SET trang_thai = 'TAM_KHOA' WHERE ma_nguoi_dung = 'T7B';
    CALL t_gia_tri("COALESCE(fn_nguoi_dung_tu_token(@t7_b2), 'KHONG')");
    CALL t_kiem_tra('L7d', v_loi = 0 AND @t_kq = 'KHONG', 'Nguoi dung bi tam khoa: token dang con han cung het hieu luc');
    CALL t_chay("CALL sp_dang_nhap('t7b', 'Mk_Test_7', @t7_x)", v_loi, v_msg);
    CALL t_kiem_tra('L7d', v_loi = 1644, 'Nguoi dung bi tam khoa khong dang nhap lai duoc');

    CALL t_gia_tri("(SELECT COUNT(*) FROM information_schema.events
                     WHERE event_schema = 'qltv_nhom8' AND event_name = 'ev_don_phien_dang_nhap')");
    CALL t_kiem_tra('L7d', @t_kq = '1', 'Co event ev_don_phien_dang_nhap');
    -- chạy thân event: xóa phiên đã đăng xuất (@t7_a), phiên quá hạn (@t7_b) và phiên của T7B bị thu hồi khi khóa
    -- tài khoản (@t7_b2, #49); chỉ còn phiên @t7_a2
    SET @t7_ev = (SELECT event_definition FROM information_schema.events
                  WHERE event_schema = 'qltv_nhom8' AND event_name = 'ev_don_phien_dang_nhap');
    CALL t_chay(@t7_ev, v_loi, v_msg);
    CALL t_gia_tri("(SELECT COUNT(*) FROM phien_dang_nhap WHERE nguoi_dung_id IN
                      (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T7A', 'T7B')))");
    CALL t_kiem_tra('L7d', v_loi = 0 AND @t_kq = '1', 'Event xoa phien da dang xuat/qua han/bi thu hoi, giu phien con han');
    CALL t_gia_tri('fn_nguoi_dung_tu_token(@t7_a2)');
    CALL t_kiem_tra('L7d', @t_kq = 'T7A', 'Phien con han van dung duoc sau khi event chay');

    -- L7e. Quyền: bạn đọc chỉ còn các procedure nhận token; không gọi thẳng procedure nhận mã người dùng
    CALL t_kiem_tra('L7e', (SELECT GROUP_CONCAT(routine_name ORDER BY routine_name)
                            FROM mysql.procs_priv
                            WHERE user = 'r_qltv_bandoc' AND db = 'qltv_nhom8' AND FIND_IN_SET('Execute', proc_priv))
                           = 'sp_bandoc_dat_truoc,sp_bandoc_ds_dat_truoc,sp_bandoc_gia_han,sp_bandoc_huy_dat_truoc,sp_bandoc_lich_su_muon,sp_bandoc_sach_dang_muon,sp_bandoc_tien_phat,sp_bandoc_tra_cuu,sp_dang_nhap,sp_dang_xuat',
        'Role ban doc chi co EXECUTE tren 10 procedure nhan token/dang nhap (khong con sp_dat_truoc, sp_huy_dat_truoc, sp_tra_cuu_sach, sp_gia_han)');
    CALL t_kiem_tra('L7e', (SELECT COUNT(*) FROM information_schema.tables
                            WHERE table_schema = 'qltv_nhom8' AND table_name = 'phien_dang_nhap') = 1
                       AND NOT EXISTS (SELECT 1 FROM information_schema.table_privileges
                                       WHERE table_schema = 'qltv_nhom8' AND table_name = 'phien_dang_nhap'
                                         AND grantee IN ('''r_qltv_bandoc''@''%''', '''r_qltv_thuthu''@''%'''))
                       AND NOT EXISTS (SELECT 1 FROM information_schema.column_privileges
                                       WHERE table_schema = 'qltv_nhom8' AND table_name = 'phien_dang_nhap'
                                         AND grantee IN ('''r_qltv_bandoc''@''%''', '''r_qltv_thuthu''@''%''')),
        'Ban doc va thu thu khong co quyen nao tren bang phien_dang_nhap');
    CALL t_kiem_tra('L7e', EXISTS (SELECT 1 FROM information_schema.routines
                                   WHERE routine_schema = 'qltv_nhom8' AND routine_name = 'sp_xac_thuc_phien')
                       AND NOT EXISTS (SELECT 1 FROM mysql.procs_priv
                                       WHERE user = 'r_qltv_thuthu' AND db = 'qltv_nhom8'
                                         AND routine_name IN ('sp_xac_thuc_phien', 'sp_dang_nhap', 'sp_dang_xuat')),
        'sp_xac_thuc_phien noi bo; thu thu khong co sp_dang_nhap/sp_dang_xuat');

    -- Dọn dữ liệu thử (bảng phien_dang_nhap chưa tồn tại ở bản cũ thì bỏ qua lỗi)
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
        DELETE FROM phien_dang_nhap WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T7A', 'T7B'));
    END;
    DELETE FROM nhat_ky_hanh_vi WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T7A', 'T7B'));
    DELETE FROM dat_truoc WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T7A', 'T7B'));
    DELETE FROM tai_khoan WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T7A', 'T7B'));
    DELETE FROM nguoi_dung WHERE ma_nguoi_dung IN ('T7A', 'T7B');
    DELETE FROM sach WHERE ma_sach = 'S_T7';
    CALL t_kiem_tra('L7z', (SELECT COUNT(*) FROM nguoi_dung WHERE ma_nguoi_dung LIKE 'T7%') = 0
                       AND (SELECT COUNT(*) FROM sach WHERE ma_sach = 'S_T7') = 0,
        'Da don sach du lieu thu L7');
END$$

-- L8 (#47): tra cứu tiếng Việt. innodb_ft_min_token_size = 3 làm FULLTEXT bỏ âm tiết 1-2 ký tự ("cơ sở" không ra gì),
-- stopword tiếng Anh (it, an, for...) bị bỏ khỏi chỉ mục, và từ khóa % _ \ được LIKE hiểu là ký tự đại diện.
-- Sửa: FULLTEXT WITH PARSER ngram tắt stopword; sp_tra_cuu_sach escape ký tự đại diện và trả rỗng khi từ khóa rỗng.
-- Kết quả của procedure (result set) không đọc được từ trong procedure khác, nên test kiểm tra chỉ mục và hàm escape;
-- hành vi của chính sp_tra_cuu_sach nằm ở phần B của 09_smoke_test.sql (có ghi số dòng kỳ vọng).
DROP PROCEDURE IF EXISTS t_l8$$
CREATE PROCEDURE t_l8()
BEGIN
    DECLARE v_gach CHAR(1) DEFAULT CHAR(92 USING utf8mb4);
    DECLARE v_mau VARCHAR(765);

    -- L8a. Chỉ mục FULLTEXT tìm được âm tiết ngắn và từ trùng stopword. Truy vấn dạng cụm từ BOOLEAN như sp_tra_cuu_sach.
    CALL t_kiem_tra('L8a', (SELECT COUNT(*) FROM sach WHERE ma_sach IN ('S001', 'S002')
                                AND MATCH(ten_sach, mo_ta) AGAINST ('"cơ sở"' IN BOOLEAN MODE)) = 2,
        'FULLTEXT: "co so" tim ra S001 va S002');
    CALL t_kiem_tra('L8a', (SELECT COUNT(*) FROM sach WHERE MATCH(ten_sach, mo_ta) AGAINST ('"co so"' IN BOOLEAN MODE)) = 2,
        'FULLTEXT: "co so" khong dau cung ra dung 2 sach');
    CALL t_kiem_tra('L8a', (SELECT COUNT(*) FROM sach WHERE ma_sach = 'S008'
                                AND MATCH(ten_sach, mo_ta) AGAINST ('"hệ điều hành"' IN BOOLEAN MODE)) = 1,
        'FULLTEXT: "he dieu hanh" tim ra S008 (am tiet "he" 2 ky tu)');
    CALL t_kiem_tra('L8a', (SELECT COUNT(*) FROM sach WHERE ma_sach IN ('S011', 'S013')
                                AND MATCH(ten_sach, mo_ta) AGAINST ('"IT"' IN BOOLEAN MODE)) = 2,
        'FULLTEXT: "IT" tim ra S011 (ten) va S013 (mo ta), khong bi coi la stopword');
    -- Cụm từ buộc các bigram liền nhau: không khớp rời rạc (NATURAL LANGUAGE MODE trả 12/15 sách cho "Tanenbaum")
    CALL t_kiem_tra('L8a', (SELECT COUNT(*) FROM sach WHERE MATCH(ten_sach, mo_ta) AGAINST ('"Tanenbaum"' IN BOOLEAN MODE)) = 0,
        'FULLTEXT: "Tanenbaum" (ten tac gia, khong nam trong ten/mo ta) khong khop sach nao');
    CALL t_kiem_tra('L8a', (SELECT GROUP_CONCAT(ma_sach) FROM sach WHERE MATCH(ten_sach, mo_ta) AGAINST ('"java"' IN BOOLEAN MODE)) = 'S004',
        'FULLTEXT: "java" chi khop S004');
    CALL t_kiem_tra('L8a', (SELECT COUNT(*) FROM sach WHERE MATCH(ten_sach, mo_ta) AGAINST ('""' IN BOOLEAN MODE)) = 0,
        'FULLTEXT: cum tu rong khong loi, khong khop sach nao');

    -- L8b. Escape ký tự đại diện của LIKE
    CALL t_kiem_tra('L8b', fn_escape_like('100%_a') = CONCAT('100', v_gach, '%', v_gach, '_a') COLLATE utf8mb4_bin, 'fn_escape_like them dau gach nguoc truoc % va _');
    CALL t_kiem_tra('L8b', fn_escape_like(CONCAT('a', v_gach, 'b')) = CONCAT('a', v_gach, v_gach, 'b') COLLATE utf8mb4_bin, 'fn_escape_like nhan doi dau gach nguoc');
    CALL t_kiem_tra('L8b', fn_escape_like('Co so') = 'Co so' COLLATE utf8mb4_bin, 'Tu khoa thuong giu nguyen');
    -- Mẫu LIKE gán vào biến như trong sp_tra_cuu_sach (ghép trực tiếp literal với kết quả hàm thì collation lệch nhau)
    SET v_mau = CONCAT('%', fn_escape_like('%'), '%');
    CALL t_kiem_tra('L8b', (SELECT COUNT(*) FROM vw_tra_cuu_sach WHERE ten_sach LIKE v_mau) = 0,
        'Tim "%" theo nghia den khong khop sach nao');
    SET v_mau = CONCAT('%', fn_escape_like('_'), '%');
    CALL t_kiem_tra('L8b', (SELECT COUNT(*) FROM vw_tra_cuu_sach WHERE ten_sach LIKE v_mau) = 0,
        'Tim "_" theo nghia den khong khop sach nao');
    SET v_mau = CONCAT('%', fn_escape_like('cơ sở'), '%');
    CALL t_kiem_tra('L8b', (SELECT COUNT(*) FROM vw_tra_cuu_sach WHERE ten_sach LIKE v_mau) = 2,
        'Tu khoa thuong van khop dung 2 sach');
END$$

-- L9 (#48): khớp phạm vi đề tài đã chốt (Summary): thiếu báo cáo thống kê tiền phạt; bạn đọc không xem được lượt đặt
-- trước của mình (đã được giữ sách chưa, giữ tới bao giờ) và lịch sử mượn; bạn đọc không tự gia hạn được; không có
-- thủ tục thêm sách. Đối tượng mới được gọi qua t_chay/t_gia_tri để trên bản cũ test báo FAIL thay vì dừng.
-- Chạy với autocommit = 1 trên dữ liệu thử riêng (T9A, T9B, S_T9, S_T9X), dọn sạch ở cuối.
DROP PROCEDURE IF EXISTS t_l9$$
CREATE PROCEDURE t_l9()
BEGIN
    DECLARE v_loi INT;
    DECLARE v_msg VARCHAR(512);
    DECLARE v_max_bs INT;

    INSERT INTO nguoi_dung(ma_nguoi_dung, ho_ten, loai_nguoi_dung, email)
    VALUES('T9A', 'Test L9 A', 'SINH_VIEN', 't9a@test.vn'), ('T9B', 'Test L9 B', 'SINH_VIEN', 't9b@test.vn');
    INSERT INTO tai_khoan(nguoi_dung_id, ten_dang_nhap, muoi, mat_khau_hash, vai_tro)
    SELECT id, LOWER(ma_nguoi_dung), REPEAT('b', 32), SHA2(CONCAT(REPEAT('b', 32), 'Mk_Test_9'), 256), 'BAN_DOC'
    FROM nguoi_dung WHERE ma_nguoi_dung IN ('T9A', 'T9B');
    SET @t9_a = NULL, @t9_b = NULL, @t9_pm = NULL;
    CALL t_chay("CALL sp_dang_nhap('t9a', 'Mk_Test_9', @t9_a)", v_loi, v_msg);
    CALL t_chay("CALL sp_dang_nhap('t9b', 'Mk_Test_9', @t9_b)", v_loi, v_msg);

    -- L9a. Báo cáo thống kê tiền phạt theo tháng và loại phạt; số liệu phải khớp bảng phieu_phat
    CALL t_gia_tri("(SELECT SUM(tong_tien) FROM vw_thong_ke_tien_phat)
                        = (SELECT SUM(so_tien) FROM phieu_phat WHERE trang_thai <> 'HUY')
                    AND (SELECT SUM(so_phieu) FROM vw_thong_ke_tien_phat)
                        = (SELECT COUNT(*) FROM phieu_phat WHERE trang_thai <> 'HUY')");
    CALL t_kiem_tra('L9a', @t_kq = '1', 'vw_thong_ke_tien_phat: so phieu va tong tien khop phieu_phat (khong tinh phieu HUY)');
    CALL t_gia_tri("(SELECT SUM(da_thanh_toan) FROM vw_thong_ke_tien_phat)
                        = (SELECT SUM(so_tien) FROM phieu_phat WHERE trang_thai = 'DA_THANH_TOAN')
                    AND (SELECT SUM(chua_thanh_toan) FROM vw_thong_ke_tien_phat)
                        = (SELECT SUM(so_tien) FROM phieu_phat WHERE trang_thai = 'CHUA_THANH_TOAN')");
    CALL t_kiem_tra('L9a', @t_kq = '1', 'vw_thong_ke_tien_phat: da thu va con no khop phieu_phat');
    CALL t_gia_tri("(SELECT SUM(so_phieu_huy) FROM vw_thong_ke_tien_phat)
                        = (SELECT COUNT(*) FROM phieu_phat WHERE trang_thai = 'HUY')
                    AND (SELECT COUNT(*) FROM vw_thong_ke_tien_phat)
                        = (SELECT COUNT(DISTINCT DATE_FORMAT(ngay_tao, '%Y-%m'), loai_phat) FROM phieu_phat)
                    AND NOT EXISTS (SELECT 1 FROM vw_thong_ke_tien_phat WHERE thang NOT REGEXP '^[0-9]{4}-[0-9]{2}$')");
    CALL t_kiem_tra('L9a', @t_kq = '1', 'Moi (thang, loai_phat) mot dong, thang dang YYYY-MM, dem rieng phieu HUY');

    -- L9d. Thêm sách: đầu sách + tác giả (sp_them_sach), bản sách tự sinh mã BSnnn (sp_them_ban_sach)
    SELECT COALESCE(MAX(CAST(SUBSTRING(ma_ban_sach, 3) AS UNSIGNED)), 0) INTO v_max_bs
    FROM ban_sach WHERE ma_ban_sach REGEXP '^BS[0-9]+$';
    -- COLLATE: chuỗi ghép từ literal mang collation của kết nối, so với cột (utf8mb4_unicode_ci) sẽ lỗi 1267
    SET @t9_ma_1 = CONCAT('BS', LPAD(v_max_bs + 1, GREATEST(3, CHAR_LENGTH(v_max_bs + 1)), '0')) COLLATE utf8mb4_unicode_ci;
    SET @t9_ma_2 = CONCAT('BS', LPAD(v_max_bs + 2, GREATEST(3, CHAR_LENGTH(v_max_bs + 2)), '0')) COLLATE utf8mb4_unicode_ci;

    CALL t_chay("CALL sp_them_sach('S_T9', NULL, 'Sach thu L9', 'TL01', 'NXB01', 2025, NULL, 150000, 'Mo ta L9', ' TG01 , TG02 ')", v_loi, v_msg);
    CALL t_kiem_tra('L9d', v_loi = 0 AND EXISTS (
            SELECT 1 FROM sach s JOIN the_loai tl ON tl.id = s.the_loai_id JOIN nha_xuat_ban n ON n.id = s.nxb_id
            WHERE s.ma_sach = 'S_T9' AND s.ten_sach = 'Sach thu L9' AND tl.ma_the_loai = 'TL01' AND n.ma_nxb = 'NXB01'
              AND s.nam_xuat_ban = 2025 AND s.gia_bia = 150000 AND s.ngon_ngu = 'Tiếng Việt'),
        'sp_them_sach tao dau sach dung the loai, NXB, gia bia; ngon ngu mac dinh Tieng Viet');
    CALL t_kiem_tra('L9d', (SELECT GROUP_CONCAT(t.ma_tac_gia ORDER BY t.ma_tac_gia) FROM sach_tac_gia st
                            JOIN tac_gia t ON t.id = st.tac_gia_id JOIN sach s ON s.id = st.sach_id
                            WHERE s.ma_sach = 'S_T9') = 'TG01,TG02',
        'sp_them_sach gan dung 2 tac gia tu danh sach ma (bo khoang trang)');

    CALL t_chay("CALL sp_them_ban_sach('S_T9', 1, 'Z9-01')", v_loi, v_msg);
    CALL t_kiem_tra('L9d', v_loi = 0 AND (SELECT COUNT(*) FROM ban_sach b JOIN sach s ON s.id = b.sach_id
                                          WHERE s.ma_sach = 'S_T9' AND b.ma_ban_sach = @t9_ma_1 AND b.tinh_trang = 'SAN_SANG'
                                            AND b.vi_tri_ke = 'Z9-01' AND b.ngay_nhap = CURDATE()) = 1,
        'sp_them_ban_sach: ban moi ma BS<lon nhat + 1>, SAN_SANG, dung vi tri ke, ngay nhap hom nay');

    CALL t_chay("CALL sp_them_sach('S_T9', NULL, 'Trung ma', 'TL01', 'NXB01', NULL, NULL, NULL, NULL, NULL)", v_loi, v_msg);
    CALL t_kiem_tra('L9d', v_loi = 1644 AND v_msg LIKE 'Ma sach da ton tai%', 'Trung ma sach bi tu choi');
    CALL t_chay("CALL sp_them_sach('S_T9X', NULL, 'Sach X', 'TL01', 'NXB01', NULL, NULL, NULL, NULL, 'TG01,TG99')", v_loi, v_msg);
    CALL t_kiem_tra('L9d', v_loi = 1644 AND v_msg LIKE 'Khong tim thay tac gia%TG99%'
                       AND NOT EXISTS (SELECT 1 FROM sach WHERE ma_sach = 'S_T9X'),
        'Tac gia khong ton tai: bao loi va khong de lai dau sach (nguyen tu)');
    CALL t_chay("CALL sp_them_sach('S_T9X', NULL, 'Sach X', 'TL99', 'NXB01', NULL, NULL, NULL, NULL, NULL)", v_loi, v_msg);
    CALL t_kiem_tra('L9d', v_loi = 1644 AND v_msg LIKE 'Khong tim thay the loai%', 'The loai khong ton tai bi tu choi');
    CALL t_chay("CALL sp_them_sach('S_T9X', NULL, '   ', 'TL01', 'NXB01', NULL, NULL, NULL, NULL, NULL)", v_loi, v_msg);
    CALL t_kiem_tra('L9d', v_loi = 1644 AND NOT EXISTS (SELECT 1 FROM sach WHERE ma_sach = 'S_T9X'), 'Ten sach rong bi tu choi');
    CALL t_chay("CALL sp_them_ban_sach('S_T9', 0, 'Z9-01')", v_loi, v_msg);
    CALL t_kiem_tra('L9d', v_loi = 1644, 'So ban phai lon hon 0');
    CALL t_chay("CALL sp_them_ban_sach('KHONG_CO', 1, 'Z9-01')", v_loi, v_msg);
    CALL t_kiem_tra('L9d', v_loi = 1644 AND v_msg LIKE 'Khong tim thay sach%', 'Dau sach khong ton tai bi tu choi');

    -- Bản cũ không có sp_them_sach: tự tạo dữ liệu để các kiểm tra L9b/L9c sau vẫn chạy được (và FAIL đúng chỗ)
    IF NOT EXISTS (SELECT 1 FROM sach WHERE ma_sach = 'S_T9') THEN
        INSERT INTO sach(ma_sach, ten_sach, the_loai_id, nxb_id)
        VALUES('S_T9', 'Sach thu L9', (SELECT MIN(id) FROM the_loai), (SELECT MIN(id) FROM nha_xuat_ban));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM ban_sach b JOIN sach s ON s.id = b.sach_id WHERE s.ma_sach = 'S_T9') THEN
        INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap)
        VALUES('BS_T9', (SELECT id FROM sach WHERE ma_sach = 'S_T9'), 'Z9-01', CURDATE());
    END IF;
    SET @t9_bs = (SELECT MIN(b.ma_ban_sach) FROM ban_sach b JOIN sach s ON s.id = b.sach_id WHERE s.ma_sach = 'S_T9');

    -- T9B mượn bản duy nhất của S_T9
    CALL sp_tao_phieu_muon('T9B', 'CB001', @t9_pm);
    CALL sp_them_sach_vao_phieu(@t9_pm, @t9_bs);

    -- L9c. Bạn đọc tự gia hạn bằng token, chỉ trên lượt mượn của chính mình
    CALL t_chay("CALL sp_bandoc_gia_han('T9B', @t9_bs, 3)", v_loi, v_msg);
    CALL t_kiem_tra('L9c', v_loi = 1644 AND v_msg LIKE 'Phien dang nhap%', 'sp_bandoc_gia_han tu choi ma nguoi dung tho');
    CALL t_chay('CALL sp_bandoc_gia_han(@t9_a, @t9_bs, 3)', v_loi, v_msg);
    CALL t_kiem_tra('L9c', v_loi = 1644 AND v_msg LIKE 'Ban sach khong co luot muon dang mo%',
        'T9A khong gia han duoc sach T9B dang muon (bao nhu khong co luot muon, khong lo ai dang muon)');
    CALL t_kiem_tra('L9c', (SELECT c.so_lan_gia_han FROM ct_phieu_muon c JOIN ban_sach b ON b.id = c.ban_sach_id
                            WHERE b.ma_ban_sach = @t9_bs AND c.ngay_tra IS NULL) = 0,
        'Luot muon cua T9B chua bi gia han');
    CALL t_chay('CALL sp_bandoc_gia_han(@t9_b, @t9_bs, 3)', v_loi, v_msg);
    CALL t_kiem_tra('L9c', v_loi = 0 AND (SELECT COUNT(*) FROM ct_phieu_muon c JOIN ban_sach b ON b.id = c.ban_sach_id
                                          WHERE b.ma_ban_sach = @t9_bs AND c.ngay_tra IS NULL AND c.so_lan_gia_han = 1
                                            AND c.han_tra = DATE_ADD(CURDATE(), INTERVAL fn_tham_so('SO_NGAY_MUON') + 3 DAY)) = 1,
        'T9B tu gia han 3 ngay: han_tra them 3 ngay, so_lan_gia_han = 1');
    CALL t_kiem_tra('L9c', EXISTS (SELECT 1 FROM nhat_ky_hanh_vi k JOIN nguoi_dung nd ON nd.id = k.nguoi_dung_id
                                   WHERE nd.ma_nguoi_dung = 'T9B' AND k.loai_hanh_vi = 'GIA_HAN'),
        'Nhat ky GIA_HAN ghi cho T9B');
    CALL t_chay('CALL sp_bandoc_gia_han(@t9_b, @t9_bs, 3)', v_loi, v_msg);
    CALL t_kiem_tra('L9c', v_loi = 1644 AND v_msg LIKE 'Luot muon da gia han toi da%', 'Ban doc van bi gioi han so lan gia han');
    CALL t_chay('CALL sp_gia_han(@t9_bs, 3)', v_loi, v_msg);
    CALL t_kiem_tra('L9c', v_loi = 1644 AND v_msg LIKE 'Luot muon da gia han toi da%'
                       AND (SELECT COUNT(*) FROM information_schema.parameters
                            WHERE specific_schema = 'qltv_nhom8' AND specific_name = 'sp_gia_han') = 2,
        'sp_gia_han cua thu thu giu nguyen 2 tham so va cung quy tac');
    CALL t_kiem_tra('L9c', NOT EXISTS (SELECT 1 FROM mysql.procs_priv
                                       WHERE db = 'qltv_nhom8' AND routine_name = 'sp_gia_han_luot_muon'),
        'sp_gia_han_luot_muon (noi bo) khong cap cho vai tro nao');

    -- L9b. Bạn đọc theo dõi lượt đặt trước (thứ tự chờ, đã được giữ bản nào, giữ tới khi nào) và lịch sử mượn
    CALL t_chay("CALL sp_bandoc_dat_truoc(@t9_a, 'S_T9')", v_loi, v_msg);
    CALL t_gia_tri("(SELECT CONCAT(trang_thai, '|', thu_tu_cho, '|', COALESCE(ma_ban_sach, '-'))
                     FROM vw_dat_truoc WHERE ma_nguoi_dung = 'T9A' AND ma_sach = 'S_T9')");
    CALL t_kiem_tra('L9b', v_loi = 0 AND @t_kq = 'CHO_XU_LY|1|-', 'vw_dat_truoc: T9A CHO_XU_LY, dung thu 1 trong hang cho');
    -- nhập thêm bản: trigger giữ ngay cho T9A
    CALL t_chay("CALL sp_them_ban_sach('S_T9', 1, 'Z9-02')", v_loi, v_msg);
    CALL t_kiem_tra('L9d', v_loi = 0 AND (SELECT tinh_trang FROM ban_sach WHERE ma_ban_sach = @t9_ma_2) = 'DANG_GIU',
        'sp_them_ban_sach khi co nguoi cho: ban moi DANG_GIU cho nguoi dat som nhat');
    CALL t_gia_tri("(SELECT CONCAT(trang_thai, '|', COALESCE(thu_tu_cho, '-'), '|', ma_ban_sach, '|', han_giu > NOW())
                     FROM vw_dat_truoc WHERE ma_nguoi_dung = 'T9A' AND ma_sach = 'S_T9')");
    CALL t_kiem_tra('L9b', @t_kq = CONCAT('SAN_SANG_NHAN|-|', @t9_ma_2, '|1'),
        'vw_dat_truoc: T9A SAN_SANG_NHAN, thay ma ban sach dang giu va han giu');

    CALL sp_tra_sach(@t9_bs, 'BINH_THUONG');
    CALL t_gia_tri("(SELECT CONCAT(ma_phieu, '|', ma_sach, '|', ngay_tra = CURDATE(), '|', tinh_trang_tra, '|', so_lan_gia_han)
                     FROM vw_lich_su_muon WHERE ma_nguoi_dung = 'T9B')");
    CALL t_kiem_tra('L9b', @t_kq = CONCAT(@t9_pm, '|S_T9|1|BINH_THUONG|1'),
        'vw_lich_su_muon: T9B co luot da tra hom nay, BINH_THUONG, da gia han 1 lan');
    CALL t_gia_tri("(SELECT COUNT(*) FROM vw_lich_su_muon WHERE ma_nguoi_dung = 'T9A')");
    CALL t_kiem_tra('L9b', @t_kq = '0', 'vw_lich_su_muon: T9A chua muon gi');
    CALL t_gia_tri("(SELECT COUNT(*) FROM vw_lich_su_muon) = (SELECT COUNT(*) FROM ct_phieu_muon)");
    CALL t_kiem_tra('L9b', @t_kq = '1', 'vw_lich_su_muon gom moi luot muon (ca dang muon va da tra)');

    CALL t_chay("CALL sp_bandoc_lich_su_muon('T9B')", v_loi, v_msg);
    CALL t_kiem_tra('L9b', v_loi = 1644 AND v_msg LIKE 'Phien dang nhap%', 'sp_bandoc_lich_su_muon tu choi ma nguoi dung tho');
    CALL t_chay('CALL sp_bandoc_lich_su_muon(@t9_b)', v_loi, v_msg);
    CALL t_kiem_tra('L9b', v_loi = 0, 'sp_bandoc_lich_su_muon voi token hop le chay duoc');
    CALL t_chay("CALL sp_bandoc_ds_dat_truoc('T9A')", v_loi, v_msg);
    CALL t_kiem_tra('L9b', v_loi = 1644 AND v_msg LIKE 'Phien dang nhap%', 'sp_bandoc_ds_dat_truoc tu choi ma nguoi dung tho');
    CALL t_chay('CALL sp_bandoc_ds_dat_truoc(@t9_a)', v_loi, v_msg);
    CALL t_kiem_tra('L9b', v_loi = 0, 'sp_bandoc_ds_dat_truoc voi token hop le chay duoc');

    -- L9e. Quyền: thủ thư dùng được báo cáo và thủ tục thêm sách; bạn đọc không đọc thẳng view (xem được người khác)
    CALL t_kiem_tra('L9e', (SELECT COUNT(*) FROM information_schema.table_privileges
                            WHERE grantee = '''r_qltv_thuthu''@''%''' AND table_schema = 'qltv_nhom8' AND privilege_type = 'SELECT'
                              AND table_name IN ('vw_thong_ke_tien_phat', 'vw_lich_su_muon', 'vw_dat_truoc')) = 3,
        'Thu thu SELECT duoc 3 view moi');
    CALL t_kiem_tra('L9e', (SELECT COUNT(*) FROM mysql.procs_priv
                            WHERE user = 'r_qltv_thuthu' AND db = 'qltv_nhom8' AND FIND_IN_SET('Execute', proc_priv)
                              AND routine_name IN ('sp_them_sach', 'sp_them_ban_sach')) = 2,
        'Thu thu goi duoc sp_them_sach, sp_them_ban_sach');
    CALL t_kiem_tra('L9e', NOT EXISTS (SELECT 1 FROM information_schema.table_privileges
                                       WHERE grantee = '''r_qltv_bandoc''@''%''' AND table_schema = 'qltv_nhom8'
                                         AND table_name IN ('vw_thong_ke_tien_phat', 'vw_lich_su_muon', 'vw_dat_truoc')),
        'Ban doc khong SELECT thang 3 view moi (chi qua procedure nhan token)');

    -- Dọn dữ liệu thử
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
        DELETE FROM phien_dang_nhap WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T9A', 'T9B'));
    END;
    DELETE FROM nhat_ky_hanh_vi WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T9A', 'T9B'));
    DELETE FROM dat_truoc WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T9A', 'T9B'));
    DELETE FROM phieu_phat WHERE ct_phieu_muon_id IN (
        SELECT c.id FROM ct_phieu_muon c JOIN phieu_muon p ON p.id = c.phieu_muon_id
        WHERE p.nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T9A', 'T9B')));
    DELETE FROM ct_phieu_muon WHERE phieu_muon_id IN (
        SELECT id FROM phieu_muon WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T9A', 'T9B')));
    DELETE FROM phieu_muon WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T9A', 'T9B'));
    DELETE FROM ban_sach WHERE sach_id IN (SELECT id FROM sach WHERE ma_sach IN ('S_T9', 'S_T9X'));
    DELETE FROM sach_tac_gia WHERE sach_id IN (SELECT id FROM sach WHERE ma_sach IN ('S_T9', 'S_T9X'));
    DELETE FROM sach WHERE ma_sach IN ('S_T9', 'S_T9X');
    DELETE FROM tai_khoan WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T9A', 'T9B'));
    DELETE FROM nguoi_dung WHERE ma_nguoi_dung IN ('T9A', 'T9B');
    CALL t_kiem_tra('L9z', (SELECT COUNT(*) FROM nguoi_dung WHERE ma_nguoi_dung LIKE 'T9%') = 0
                       AND (SELECT COUNT(*) FROM sach WHERE ma_sach LIKE 'S\_T9%') = 0,
        'Da don sach du lieu thu L9');
END$$

-- L10 (#49): (a) khóa tài khoản hoặc đổi mật khẩu không thu hồi phiên: khóa rồi mở lại thì token cũ dùng lại được;
-- (b) cấp bản cho người đặt trước chỉ xét HOAT_DONG: bản bị giữ cho người đang quá hạn/nợ phạt (không mượn được),
-- chặn người khác tới hết hạn giữ; (c) một mã bản sách 'BS' + 20 chữ số làm sp_them_ban_sach lỗi 1264 mãi.
-- Chạy với autocommit = 1 trên dữ liệu thử riêng (T10A, T10B, S_T10, S_T10X), dọn sạch ở cuối.
DROP PROCEDURE IF EXISTS t_l10$$
CREATE PROCEDURE t_l10()
BEGIN
    DECLARE v_loi INT;
    DECLARE v_msg VARCHAR(512);
    DECLARE v_max_bs BIGINT;

    INSERT INTO nguoi_dung(ma_nguoi_dung, ho_ten, loai_nguoi_dung, email)
    VALUES('T10A', 'Test L10 A', 'SINH_VIEN', 't10a@test.vn'), ('T10B', 'Test L10 B', 'SINH_VIEN', 't10b@test.vn');
    INSERT INTO tai_khoan(nguoi_dung_id, ten_dang_nhap, muoi, mat_khau_hash, vai_tro)
    SELECT id, LOWER(ma_nguoi_dung), REPEAT('c', 32), SHA2(CONCAT(REPEAT('c', 32), 'Mk_Test_10'), 256), 'BAN_DOC'
    FROM nguoi_dung WHERE ma_nguoi_dung IN ('T10A', 'T10B');
    SET @t10_a = NULL, @t10_b = NULL, @t10_b2 = NULL;
    CALL sp_dang_nhap('t10a', 'Mk_Test_10', @t10_a);
    CALL sp_dang_nhap('t10b', 'Mk_Test_10', @t10_b);

    -- L10a. Khóa rồi mở lại: phiên cũ phải chết; phiên của người khác không bị ảnh hưởng
    CALL sp_doi_trang_thai_nguoi_dung('T10B', 'TAM_KHOA');
    CALL sp_doi_trang_thai_nguoi_dung('T10B', 'HOAT_DONG');
    UPDATE tai_khoan SET trang_thai = 'HOAT_DONG' WHERE ten_dang_nhap = 't10b';
    CALL t_kiem_tra('L10a', fn_nguoi_dung_tu_token(@t10_b) IS NULL,
        'Khoa roi mo lai tai khoan: token cu khong dung lai duoc');
    CALL t_kiem_tra('L10a', fn_nguoi_dung_tu_token(@t10_a) = 'T10A' COLLATE utf8mb4_unicode_ci, 'Phien cua nguoi khac van con hieu luc');
    -- Đổi mật khẩu: phiên cũ chết, đăng nhập lại bằng mật khẩu mới được
    CALL sp_dang_nhap('t10b', 'Mk_Test_10', @t10_b2);
    UPDATE tai_khoan SET mat_khau_hash = SHA2(CONCAT(muoi, 'Mk_Moi_10'), 256) WHERE ten_dang_nhap = 't10b';
    CALL t_kiem_tra('L10a', fn_nguoi_dung_tu_token(@t10_b2) IS NULL, 'Doi mat khau: token cu khong dung duoc');
    CALL t_chay("CALL sp_dang_nhap('t10b', 'Mk_Moi_10', @t10_b2)", v_loi, v_msg);
    CALL t_kiem_tra('L10a', v_loi = 0 AND fn_nguoi_dung_tu_token(@t10_b2) = 'T10B' COLLATE utf8mb4_unicode_ci, 'Dang nhap lai bang mat khau moi duoc');

    -- L10c. Mã bản sách lạ (quá 9 chữ số) không làm hỏng việc sinh mã của sp_them_ban_sach
    CALL sp_them_sach('S_T10', NULL, 'Sach thu L10', 'TL01', 'NXB01', 2025, NULL, 100000, NULL, 'TG01');
    CALL sp_them_sach('S_T10X', NULL, 'Sach thu L10 X', 'TL01', 'NXB01', 2025, NULL, 100000, NULL, 'TG01');
    INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap)
    SELECT 'BS99999999999999999999', id, 'Z10', CURDATE() FROM sach WHERE ma_sach = 'S_T10';
    SELECT COALESCE(MAX(CAST(SUBSTRING(ma_ban_sach, 3) AS UNSIGNED)), 0) INTO v_max_bs
    FROM ban_sach WHERE ma_ban_sach REGEXP '^BS[0-9]{1,9}$';
    CALL t_chay("CALL sp_them_ban_sach('S_T10', 1, 'Z10-01')", v_loi, v_msg);
    CALL t_kiem_tra('L10c', v_loi = 0 AND EXISTS (SELECT 1 FROM ban_sach
                       WHERE ma_ban_sach = CONCAT('BS', LPAD(v_max_bs + 1, GREATEST(3, CHAR_LENGTH(v_max_bs + 1)), '0'))
                                           COLLATE utf8mb4_unicode_ci),
        'Co ma BS + 20 chu so: sp_them_ban_sach van sinh ma tiep theo cua ma BSnnn binh thuong');
    DELETE FROM ban_sach WHERE sach_id = (SELECT id FROM sach WHERE ma_sach = 'S_T10');
    -- bản sách thử cho L10b: mã cố định (không theo dạng BSnnn), không phụ thuộc sp_them_ban_sach
    INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap)
    SELECT 'BST10X', id, 'Z10', CURDATE() FROM sach WHERE ma_sach = 'S_T10'
    UNION ALL SELECT 'BST10W', id, 'Z10', CURDATE() FROM sach WHERE ma_sach = 'S_T10X';

    -- L10b. T10B mượn bản duy nhất của S_T10; T10A đặt trước khi còn đủ điều kiện, sau đó quá hạn một cuốn khác
    CALL sp_tao_phieu_muon('T10B', 'CB001', @t10_pm);
    CALL sp_them_sach_vao_phieu(@t10_pm, 'BST10X');
    CALL sp_dat_truoc('T10A', 'S_T10');
    INSERT INTO phieu_muon(ma_phieu, nguoi_dung_id, nhan_vien_id, ngay_muon, trang_thai)
    SELECT 'PM_T10', n.id, cb.id, CURDATE() - INTERVAL 20 DAY, 'DANG_MUON'
    FROM nguoi_dung n JOIN nguoi_dung cb ON cb.ma_nguoi_dung = 'CB001' WHERE n.ma_nguoi_dung = 'T10A';
    -- lấy id trước: INSERT ... SELECT từ ban_sach thì trigger không được ghi ban_sach (lỗi 1442)
    SELECT id INTO @t10_pm_id FROM phieu_muon WHERE ma_phieu = 'PM_T10';
    SELECT id INTO @t10_w_id FROM ban_sach WHERE ma_ban_sach = 'BST10W';
    INSERT INTO ct_phieu_muon(phieu_muon_id, ban_sach_id, han_tra)
    VALUES(@t10_pm_id, @t10_w_id, CURDATE() - INTERVAL 6 DAY);
    CALL t_kiem_tra('L10b', (SELECT fn_ly_do_khong_the_dat_truoc(id) FROM nguoi_dung WHERE ma_nguoi_dung = 'T10A')
                            = 'Dang giu sach qua han chua tra' COLLATE utf8mb4_unicode_ci, 'Chuan bi: T10A dang qua han, khong du dieu kien');
    CALL t_kiem_tra('L10b', (SELECT thu_tu_cho FROM vw_dat_truoc WHERE ma_nguoi_dung = 'T10A' AND ma_sach = 'S_T10') IS NULL,
        'vw_dat_truoc: nguoi khong du dieu kien khong co thu tu cho');
    CALL sp_tra_sach('BST10X', 'BINH_THUONG');
    CALL t_kiem_tra('L10b', (SELECT tinh_trang FROM ban_sach WHERE ma_ban_sach = 'BST10X') = 'SAN_SANG'
                       AND (SELECT d.trang_thai FROM dat_truoc d JOIN nguoi_dung n ON n.id = d.nguoi_dung_id
                            WHERE n.ma_nguoi_dung = 'T10A') = 'CHO_XU_LY',
        'Tra sach: khong giu ban cho nguoi qua han, ban SAN_SANG, luot dat van cho');
    CALL sp_them_ban_sach('S_T10', 1, 'Z10-03');
    CALL t_kiem_tra('L10b', (SELECT COUNT(*) FROM ban_sach b JOIN sach s ON s.id = b.sach_id
                             WHERE s.ma_sach = 'S_T10' AND b.tinh_trang = 'DANG_GIU') = 0,
        'Nhap ban moi: khong giu cho nguoi qua han');

    -- Dọn dữ liệu thử
    DELETE FROM phien_dang_nhap WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T10A', 'T10B'));
    DELETE FROM nhat_ky_hanh_vi WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T10A', 'T10B'));
    DELETE FROM dat_truoc WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T10A', 'T10B'));
    DELETE FROM phieu_phat WHERE ct_phieu_muon_id IN (
        SELECT c.id FROM ct_phieu_muon c JOIN phieu_muon p ON p.id = c.phieu_muon_id
        WHERE p.nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T10A', 'T10B')));
    DELETE FROM ct_phieu_muon WHERE phieu_muon_id IN (
        SELECT id FROM phieu_muon WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T10A', 'T10B')));
    DELETE FROM phieu_muon WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T10A', 'T10B'));
    DELETE FROM ban_sach WHERE sach_id IN (SELECT id FROM sach WHERE ma_sach IN ('S_T10', 'S_T10X'));
    DELETE FROM sach_tac_gia WHERE sach_id IN (SELECT id FROM sach WHERE ma_sach IN ('S_T10', 'S_T10X'));
    DELETE FROM sach WHERE ma_sach IN ('S_T10', 'S_T10X');
    DELETE FROM tai_khoan WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T10A', 'T10B'));
    DELETE FROM nguoi_dung WHERE ma_nguoi_dung IN ('T10A', 'T10B');
    CALL t_kiem_tra('L10z', (SELECT COUNT(*) FROM nguoi_dung WHERE ma_nguoi_dung LIKE 'T10%') = 0
                        AND (SELECT COUNT(*) FROM sach WHERE ma_sach LIKE 'S\_T10%') = 0,
        'Da don sach du lieu thu L10');
END$$

-- L11s (#50): dữ liệu mẫu đặt trước phải khớp quy tắc. Chạy TRƯỚC t_l1 (các test sau ghi đè dữ liệu mẫu).
DROP PROCEDURE IF EXISTS t_l11_seed$$
CREATE PROCEDURE t_l11_seed()
BEGIN
    -- Lượt đặt đang hoạt động: lúc đặt, người đặt không nợ phạt và không giữ sách quá hạn
    CALL t_kiem_tra('L11s', (SELECT COUNT(*) FROM dat_truoc d
                             WHERE d.trang_thai IN ('CHO_XU_LY', 'SAN_SANG_NHAN')
                               AND (EXISTS (SELECT 1 FROM phieu_phat pp
                                            JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
                                            JOIN phieu_muon p ON p.id = c.phieu_muon_id
                                            WHERE p.nguoi_dung_id = d.nguoi_dung_id AND pp.trang_thai <> 'HUY'
                                              AND pp.ngay_tao <= DATE(d.ngay_dat)
                                              AND (pp.ngay_thanh_toan IS NULL OR pp.ngay_thanh_toan > DATE(d.ngay_dat)))
                                    OR EXISTS (SELECT 1 FROM ct_phieu_muon c
                                               JOIN phieu_muon p ON p.id = c.phieu_muon_id
                                               WHERE p.nguoi_dung_id = d.nguoi_dung_id AND c.han_tra < DATE(d.ngay_dat)
                                                 AND (c.ngay_tra IS NULL OR c.ngay_tra > DATE(d.ngay_dat))))) = 0,
        'Seed: khong co luot dat dang hoat dong cua nguoi bi chan luc dat');
    CALL t_kiem_tra('L11s', (SELECT COUNT(*) FROM dat_truoc
                             WHERE trang_thai = 'SAN_SANG_NHAN' AND fn_ly_do_khong_the_dat_truoc(nguoi_dung_id) IS NOT NULL) = 0,
        'Seed: ban dang giu chi giu cho nguoi du dieu kien');
    CALL t_kiem_tra('L11s', (SELECT COUNT(*) FROM dat_truoc
                             WHERE trang_thai IN ('DA_NHAN', 'HET_HAN') AND (ban_sach_id IS NULL OR han_giu IS NULL)) = 0,
        'Seed: luot DA_NHAN/HET_HAN deu da tung giu mot ban sach');
    CALL t_kiem_tra('L11s', (SELECT COUNT(*) FROM dat_truoc d
                             WHERE d.trang_thai = 'DA_NHAN'
                               AND NOT EXISTS (SELECT 1 FROM ct_phieu_muon c JOIN phieu_muon p ON p.id = c.phieu_muon_id
                                               WHERE p.nguoi_dung_id = d.nguoi_dung_id AND c.ban_sach_id = d.ban_sach_id
                                                 AND p.ngay_muon BETWEEN DATE(d.ngay_dat) AND DATE(d.han_giu))) = 0,
        'Seed: luot DA_NHAN co luot muon dung ban, trong han giu');
    CALL t_kiem_tra('L11s', (SELECT COUNT(*) FROM dat_truoc d
                             JOIN ct_phieu_muon c ON c.ngay_tra IS NULL
                             JOIN phieu_muon p ON p.id = c.phieu_muon_id AND p.nguoi_dung_id = d.nguoi_dung_id
                             JOIN ban_sach b ON b.id = c.ban_sach_id AND b.sach_id = d.sach_id
                             WHERE d.trang_thai IN ('CHO_XU_LY', 'SAN_SANG_NHAN')) = 0,
        'Seed: khong ai dat truoc dau sach minh dang muon');
END$$

-- L11 (#50): (a) không được đặt trước đầu sách mình đang mượn; (b) người chờ không đủ điều kiện (bị khóa, quá hạn,
-- nợ phạt) không chặn người đang mượn gia hạn, giống cách sp_cap_phat_ban_sach bỏ qua họ (#49).
DROP PROCEDURE IF EXISTS t_l11$$
CREATE PROCEDURE t_l11()
BEGIN
    DECLARE v_loi INT;
    DECLARE v_msg VARCHAR(512);

    INSERT INTO nguoi_dung(ma_nguoi_dung, ho_ten, loai_nguoi_dung, email)
    VALUES('T11A', 'Test L11 A', 'SINH_VIEN', 't11a@test.vn'), ('T11B', 'Test L11 B', 'SINH_VIEN', 't11b@test.vn');
    CALL sp_them_sach('S_T11', NULL, 'Sach thu L11', 'TL01', 'NXB01', 2025, NULL, 100000, NULL, 'TG01');
    INSERT INTO ban_sach(ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap)
    SELECT 'BST11X', id, 'Z11', CURDATE() FROM sach WHERE ma_sach = 'S_T11';
    CALL sp_tao_phieu_muon('T11A', 'CB001', @t11_pm);
    CALL sp_them_sach_vao_phieu(@t11_pm, 'BST11X');

    -- L11a. T11A đang mượn bản duy nhất của S_T11: không tự đặt trước được; người khác thì được
    CALL t_chay("CALL sp_dat_truoc('T11A', 'S_T11')", v_loi, v_msg);
    CALL t_kiem_tra('L11a', v_loi = 1644, 'Dat truoc dau sach minh dang muon bi tu choi');
    CALL t_chay("CALL sp_dat_truoc('T11B', 'S_T11')", v_loi, v_msg);
    CALL t_kiem_tra('L11a', v_loi = 0, 'Nguoi khac van dat truoc duoc');

    -- L11b. Người chờ đủ điều kiện vẫn chặn gia hạn; bị khóa thì không chặn nữa
    CALL t_chay("CALL sp_gia_han('BST11X', 7)", v_loi, v_msg);
    CALL t_kiem_tra('L11b', v_loi = 1644, 'Nguoi cho du dieu kien: khong gia han duoc');
    CALL sp_doi_trang_thai_nguoi_dung('T11B', 'TAM_KHOA');
    CALL t_chay("CALL sp_gia_han('BST11X', 7)", v_loi, v_msg);
    CALL t_kiem_tra('L11b', v_loi = 0 AND (SELECT so_lan_gia_han FROM ct_phieu_muon c JOIN ban_sach b ON b.id = c.ban_sach_id
                                           WHERE b.ma_ban_sach = 'BST11X' AND c.ngay_tra IS NULL) = 1,
        'Nguoi cho bi khoa: gia han duoc');

    -- Dọn dữ liệu thử
    DELETE FROM nhat_ky_hanh_vi WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T11A', 'T11B'));
    DELETE FROM dat_truoc WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T11A', 'T11B'));
    DELETE FROM ct_phieu_muon WHERE phieu_muon_id IN (
        SELECT id FROM phieu_muon WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T11A', 'T11B')));
    DELETE FROM phieu_muon WHERE nguoi_dung_id IN (SELECT id FROM nguoi_dung WHERE ma_nguoi_dung IN ('T11A', 'T11B'));
    DELETE FROM ban_sach WHERE sach_id IN (SELECT id FROM sach WHERE ma_sach = 'S_T11');
    DELETE FROM sach_tac_gia WHERE sach_id IN (SELECT id FROM sach WHERE ma_sach = 'S_T11');
    DELETE FROM sach WHERE ma_sach = 'S_T11';
    DELETE FROM nguoi_dung WHERE ma_nguoi_dung IN ('T11A', 'T11B');
    CALL t_kiem_tra('L11z', (SELECT COUNT(*) FROM nguoi_dung WHERE ma_nguoi_dung LIKE 'T11%') = 0
                        AND (SELECT COUNT(*) FROM sach WHERE ma_sach = 'S_T11') = 0,
        'Da don sach du lieu thu L11');
END$$

DELIMITER ;

CALL t_l11_seed();
CALL t_l1();
CALL t_l2();
CALL t_l3();
CALL t_l4();
CALL t_l5();
CALL t_l6();
CALL t_l7();
CALL t_l8();
CALL t_l9();
CALL t_l10();
CALL t_l11();

SELECT ma_test, ket_qua, mo_ta FROM tmp_ket_qua_test ORDER BY stt;

DROP PROCEDURE t_l1;
DROP PROCEDURE t_l2;
DROP PROCEDURE t_l3;
DROP PROCEDURE t_l4;
DROP PROCEDURE t_l5;
DROP PROCEDURE t_l6;
DROP PROCEDURE t_l7;
DROP PROCEDURE t_l8;
DROP PROCEDURE t_l9;
DROP PROCEDURE t_l10;
DROP PROCEDURE t_l11;
DROP PROCEDURE t_l11_seed;
DROP PROCEDURE t_chay;
DROP PROCEDURE t_gia_tri;
DROP PROCEDURE t_kiem_tra;
CALL t_ket_luan();
DROP PROCEDURE t_ket_luan;
DROP TEMPORARY TABLE tmp_ket_qua_test;

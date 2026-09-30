USE qltv_nhom8;

-- 02. SAMPLE DATA
INSERT INTO the_loai (ma_the_loai, ten_the_loai, mo_ta) VALUES
('TL01','Công nghệ thông tin','Tài liệu CNTT'),
('TL02','Khoa học máy tính','Thuật toán và khoa học máy tính'),
('TL03','Mạng máy tính','Mạng và truyền thông'),
('TL04','Cơ sở dữ liệu','CSDL và hệ quản trị'),
('TL05','Lập trình','Ngôn ngữ và kỹ thuật lập trình'),
('TL06','Toán học','Toán cơ sở và ứng dụng'),
('TL07','Kinh tế','Kinh tế và quản trị'),
('TL08','Ngoại ngữ','Tài liệu học ngoại ngữ'),
('TL09','Kỹ năng','Kỹ năng học tập và nghề nghiệp'),
('TL10','Văn học','Văn học trong và ngoài nước');

INSERT INTO nha_xuat_ban (ma_nxb, ten_nxb, dia_chi, email, sdt) VALUES
('NXB01','NXB Giáo Dục','TP.HCM','gd@nxb.vn','0281111111'),
('NXB02','NXB Trẻ','TP.HCM','tre@nxb.vn','0282222222'),
('NXB03','NXB ĐHQG TP.HCM','TP.HCM','hqg@nxb.vn','0283333333'),
('NXB04','NXB Khoa Học Kỹ Thuật','Hà Nội','khkt@nxb.vn','0241111111'),
('NXB05','NXB Thông Tin Truyền Thông','Hà Nội','tttt@nxb.vn','0242222222'),
('NXB06','NXB Lao Động','Hà Nội','ld@nxb.vn','0243333333'),
('NXB07','NXB Tổng Hợp TP.HCM','TP.HCM','th@nxb.vn','0284444444'),
('NXB08','NXB Đại Học Sư Phạm','Hà Nội','dhsp@nxb.vn','0244444444'),
('NXB09','NXB Kim Đồng','Hà Nội','kd@nxb.vn','0245555555'),
('NXB10','NXB Văn Học','Hà Nội','vh@nxb.vn','0246666666');

INSERT INTO tac_gia (ma_tac_gia, ten_tac_gia, quoc_tich, nam_sinh) VALUES
('TG01','Nguyễn Văn A','Việt Nam',1975),
('TG02','Trần Minh B','Việt Nam',1980),
('TG03','Lê Hoàng C','Việt Nam',1978),
('TG04','Phạm Thu D','Việt Nam',1985),
('TG05','Đỗ Anh E','Việt Nam',1982),
('TG06','Võ Thanh F','Việt Nam',1976),
('TG07','Nguyễn Gia G','Việt Nam',1988),
('TG08','Trần Quốc H','Việt Nam',1972),
('TG09','Lê Minh I','Việt Nam',1983),
('TG10','Phạm Văn K','Việt Nam',1979),
('TG11','Robert Martin','Hoa Kỳ',1952),
('TG12','Andrew Tanenbaum','Hoa Kỳ',1944);

INSERT INTO nguoi_dung (ma_nguoi_dung, ho_ten, loai_nguoi_dung, email, sdt, khoa_don_vi, trang_thai) VALUES
('SV001','Võ Hoàng Nhiên','SINH_VIEN','nhien@uit.edu.vn','0901000001','Khoa HTTT','HOAT_DONG'),
('SV002','Võ Hoàng Viên','SINH_VIEN','vien@uit.edu.vn','0901000002','Khoa HTTT','HOAT_DONG'),
('SV003','Võ Hoàng My','SINH_VIEN','my@uit.edu.vn','0901000003','Khoa HTTT','HOAT_DONG'),
('SV004','Nguyễn Minh Anh','SINH_VIEN','anh@uit.edu.vn','0901000004','Khoa KHMT','HOAT_DONG'),
('SV005','Trần Quốc Bảo','SINH_VIEN','bao@uit.edu.vn','0901000005','Khoa MMT','HOAT_DONG'),
('SV006','Lê Thu Hà','SINH_VIEN','ha@uit.edu.vn','0901000006','Khoa CNPM','HOAT_DONG'),
('SV007','Phạm Hoàng Long','SINH_VIEN','long@uit.edu.vn','0901000007','Khoa KTMT','TAM_KHOA'),
('SV008','Đặng Khánh Linh','SINH_VIEN','linh@uit.edu.vn','0901000008','Khoa HTTT','HOAT_DONG'),
('GV001','Nguyễn Văn Minh','GIANG_VIEN','minh.gv@uit.edu.vn','0902000001','Khoa HTTT','HOAT_DONG'),
('GV002','Trần Thị Lan','GIANG_VIEN','lan.gv@uit.edu.vn','0902000002','Khoa KHMT','HOAT_DONG'),
('CB001','Lê Quốc Huy','CAN_BO','huy.tv@uit.edu.vn','0903000001','Thư viện','HOAT_DONG'),
('CB002','Phạm Thu Trang','CAN_BO','trang.tv@uit.edu.vn','0903000002','Thư viện','HOAT_DONG');

INSERT INTO tai_khoan (nguoi_dung_id, ten_dang_nhap, mat_khau_hash, vai_tro, trang_thai)
SELECT id, LOWER(ma_nguoi_dung), SHA2(CONCAT(ma_nguoi_dung,'@Nhom8'),256),
       CASE WHEN loai_nguoi_dung='CAN_BO' THEN 'THU_THU' ELSE 'BAN_DOC' END,
       CASE WHEN trang_thai='TAM_KHOA' THEN 'KHOA' ELSE 'HOAT_DONG' END
FROM nguoi_dung;

INSERT INTO sach (ma_sach, isbn, ten_sach, the_loai_id, nxb_id, nam_xuat_ban, ngon_ngu, mo_ta) VALUES
('S001','9786040000011','Cơ sở dữ liệu',4,3,2024,'Tiếng Việt','Nhập môn CSDL'),
('S002','9786040000028','Hệ quản trị cơ sở dữ liệu',4,3,2023,'Tiếng Việt','DBMS'),
('S003','9786040000035','Cấu trúc dữ liệu và giải thuật',2,4,2022,'Tiếng Việt','DSA'),
('S004','9786040000042','Lập trình Java',5,1,2024,'Tiếng Việt','Java'),
('S005','9786040000059','Lập trình Python',5,2,2025,'Tiếng Việt','Python'),
('S006','9786040000066','Mạng máy tính căn bản',3,5,2023,'Tiếng Việt','Networking'),
('S007','9786040000073','An toàn thông tin',1,5,2024,'Tiếng Việt','Security'),
('S008','9786040000080','Hệ điều hành',1,4,2022,'Tiếng Việt','Operating Systems'),
('S009','9786040000097','Toán rời rạc',6,8,2021,'Tiếng Việt','Discrete Math'),
('S010','9786040000103','Đại số tuyến tính',6,8,2023,'Tiếng Việt','Linear Algebra'),
('S011','9786040000110','English for IT',8,1,2024,'English','English'),
('S012','9786040000127','Kỹ năng thuyết trình',9,6,2022,'Tiếng Việt','Soft skills'),
('S013','9786040000134','Quản trị dự án CNTT',7,7,2024,'Tiếng Việt','IT Project Management'),
('S014','9786040000141','Clean Code',5,2,2020,'English','Software craftsmanship'),
('S015','9786040000158','Computer Networks',3,4,2021,'English','Computer networks');

INSERT INTO sach_tac_gia (sach_id, tac_gia_id) VALUES
(1,1),(1,2),(2,3),(3,4),(3,5),(4,6),(5,7),(6,8),(6,12),(7,9),
(8,10),(8,12),(9,1),(10,2),(11,4),(12,5),(13,6),(14,11),(15,12),(15,8);

INSERT INTO ban_sach (ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap, tinh_trang) VALUES
('BS001',1,'A1-01',DATE_SUB(CURDATE(),INTERVAL 400 DAY),'DANG_MUON'),
('BS002',1,'A1-01',DATE_SUB(CURDATE(),INTERVAL 390 DAY),'SAN_SANG'),
('BS003',2,'A1-02',DATE_SUB(CURDATE(),INTERVAL 360 DAY),'DANG_MUON'),
('BS004',2,'A1-02',DATE_SUB(CURDATE(),INTERVAL 350 DAY),'SAN_SANG'),
('BS005',3,'A2-01',DATE_SUB(CURDATE(),INTERVAL 330 DAY),'SAN_SANG'),
('BS006',4,'A2-02',DATE_SUB(CURDATE(),INTERVAL 310 DAY),'DANG_MUON'),
('BS007',5,'A2-03',DATE_SUB(CURDATE(),INTERVAL 300 DAY),'SAN_SANG'),
('BS008',6,'B1-01',DATE_SUB(CURDATE(),INTERVAL 280 DAY),'DANG_MUON'),
('BS009',7,'B1-02',DATE_SUB(CURDATE(),INTERVAL 260 DAY),'SAN_SANG'),
('BS010',8,'B1-03',DATE_SUB(CURDATE(),INTERVAL 240 DAY),'HU_HONG'),
('BS011',9,'B2-01',DATE_SUB(CURDATE(),INTERVAL 220 DAY),'SAN_SANG'),
('BS012',10,'B2-02',DATE_SUB(CURDATE(),INTERVAL 200 DAY),'SAN_SANG'),
('BS013',11,'C1-01',DATE_SUB(CURDATE(),INTERVAL 180 DAY),'DANG_MUON'),
('BS014',12,'C1-02',DATE_SUB(CURDATE(),INTERVAL 160 DAY),'SAN_SANG'),
('BS015',13,'C1-03',DATE_SUB(CURDATE(),INTERVAL 140 DAY),'SAN_SANG'),
('BS016',14,'C2-01',DATE_SUB(CURDATE(),INTERVAL 120 DAY),'SAN_SANG'),
('BS017',15,'C2-02',DATE_SUB(CURDATE(),INTERVAL 100 DAY),'DANG_MUON'),
('BS018',3,'A2-01',DATE_SUB(CURDATE(),INTERVAL 90 DAY),'SAN_SANG'),
('BS019',4,'A2-02',DATE_SUB(CURDATE(),INTERVAL 80 DAY),'MAT'),
('BS020',5,'A2-03',DATE_SUB(CURDATE(),INTERVAL 70 DAY),'SAN_SANG');

INSERT INTO phieu_muon (ma_phieu, nguoi_dung_id, nhan_vien_id, ngay_muon, trang_thai) VALUES
('PM000001',1,11,DATE_SUB(CURDATE(),INTERVAL 25 DAY),'DANG_MUON'),
('PM000002',2,11,DATE_SUB(CURDATE(),INTERVAL 5 DAY),'DANG_MUON'),
('PM000003',3,12,DATE_SUB(CURDATE(),INTERVAL 40 DAY),'HOAN_TAT'),
('PM000004',4,11,DATE_SUB(CURDATE(),INTERVAL 18 DAY),'DANG_MUON'),
('PM000005',5,12,DATE_SUB(CURDATE(),INTERVAL 60 DAY),'HOAN_TAT'),
('PM000006',6,11,DATE_SUB(CURDATE(),INTERVAL 8 DAY),'DANG_MUON'),
('PM000007',8,12,DATE_SUB(CURDATE(),INTERVAL 3 DAY),'DANG_MUON'),
('PM000008',9,11,DATE_SUB(CURDATE(),INTERVAL 35 DAY),'HOAN_TAT'),
('PM000009',10,12,DATE_SUB(CURDATE(),INTERVAL 12 DAY),'DANG_MUON'),
('PM000010',1,11,DATE_SUB(CURDATE(),INTERVAL 90 DAY),'HOAN_TAT'),
('PM000011',2,12,DATE_SUB(CURDATE(),INTERVAL 70 DAY),'HOAN_TAT'),
('PM000012',3,11,DATE_SUB(CURDATE(),INTERVAL 50 DAY),'HOAN_TAT');

INSERT INTO ct_phieu_muon (phieu_muon_id, ban_sach_id, han_tra, ngay_tra, so_lan_gia_han, tinh_trang_tra) VALUES
(1,1,DATE_SUB(CURDATE(),INTERVAL 11 DAY),NULL,0,NULL),
(2,3,DATE_ADD(CURDATE(),INTERVAL 9 DAY),NULL,0,NULL),
(3,5,DATE_SUB(CURDATE(),INTERVAL 26 DAY),DATE_SUB(CURDATE(),INTERVAL 25 DAY),0,'BINH_THUONG'),
(4,6,DATE_SUB(CURDATE(),INTERVAL 4 DAY),NULL,0,NULL),
(5,10,DATE_SUB(CURDATE(),INTERVAL 46 DAY),DATE_SUB(CURDATE(),INTERVAL 44 DAY),0,'HU_HONG'),
(6,8,DATE_ADD(CURDATE(),INTERVAL 6 DAY),NULL,0,NULL),
(7,13,DATE_ADD(CURDATE(),INTERVAL 11 DAY),NULL,0,NULL),
(8,11,DATE_SUB(CURDATE(),INTERVAL 21 DAY),DATE_SUB(CURDATE(),INTERVAL 20 DAY),1,'BINH_THUONG'),
(9,17,DATE_ADD(CURDATE(),INTERVAL 2 DAY),NULL,0,NULL),
(10,19,DATE_SUB(CURDATE(),INTERVAL 76 DAY),DATE_SUB(CURDATE(),INTERVAL 70 DAY),0,'MAT'),
(11,12,DATE_SUB(CURDATE(),INTERVAL 56 DAY),DATE_SUB(CURDATE(),INTERVAL 55 DAY),0,'BINH_THUONG'),
(12,14,DATE_SUB(CURDATE(),INTERVAL 36 DAY),DATE_SUB(CURDATE(),INTERVAL 36 DAY),0,'BINH_THUONG'),
(3,7,DATE_SUB(CURDATE(),INTERVAL 26 DAY),DATE_SUB(CURDATE(),INTERVAL 26 DAY),0,'BINH_THUONG'),
(5,15,DATE_SUB(CURDATE(),INTERVAL 46 DAY),DATE_SUB(CURDATE(),INTERVAL 46 DAY),0,'BINH_THUONG'),
(8,16,DATE_SUB(CURDATE(),INTERVAL 21 DAY),DATE_SUB(CURDATE(),INTERVAL 21 DAY),0,'BINH_THUONG');

INSERT INTO phieu_phat (ct_phieu_muon_id, loai_phat, so_tien, ly_do, trang_thai, ngay_tao, ngay_thanh_toan) VALUES
(3,'QUA_HAN',5000,'Trả trễ 1 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 25 DAY),DATE_SUB(CURDATE(),INTERVAL 24 DAY)),
(5,'QUA_HAN',10000,'Trả trễ 2 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 44 DAY),DATE_SUB(CURDATE(),INTERVAL 40 DAY)),
(5,'HU_HONG',50000,'Sách hư hỏng','CHUA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 44 DAY),NULL),
(8,'QUA_HAN',5000,'Trả trễ 1 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 20 DAY),DATE_SUB(CURDATE(),INTERVAL 19 DAY)),
(10,'QUA_HAN',30000,'Trả trễ 6 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 70 DAY),DATE_SUB(CURDATE(),INTERVAL 65 DAY)),
(10,'MAT_SACH',300000,'Làm mất sách','CHUA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 70 DAY),NULL),
(11,'QUA_HAN',5000,'Trả trễ 1 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 55 DAY),DATE_SUB(CURDATE(),INTERVAL 54 DAY)),
(1,'QUA_HAN',55000,'Đang quá hạn 11 ngày','CHUA_THANH_TOAN',CURDATE(),NULL),
(4,'QUA_HAN',20000,'Đang quá hạn 4 ngày','CHUA_THANH_TOAN',CURDATE(),NULL),
(6,'QUA_HAN',0,'Dữ liệu kiểm thử','HUY',CURDATE(),NULL);

INSERT INTO dat_truoc (nguoi_dung_id, sach_id, ngay_dat, han_giu, trang_thai) VALUES
(1,3,DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_ADD(NOW(),INTERVAL 1 DAY),'CHO_XU_LY'),
(2,6,DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_ADD(NOW(),INTERVAL 2 DAY),'CHO_XU_LY'),
(3,8,DATE_SUB(NOW(),INTERVAL 5 DAY),DATE_SUB(NOW(),INTERVAL 1 DAY),'HET_HAN'),
(4,1,DATE_SUB(NOW(),INTERVAL 4 DAY),DATE_SUB(NOW(),INTERVAL 1 DAY),'DA_NHAN'),
(5,10,DATE_SUB(NOW(),INTERVAL 3 DAY),DATE_ADD(NOW(),INTERVAL 1 DAY),'SAN_SANG_NHAN'),
(6,12,DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_ADD(NOW(),INTERVAL 2 DAY),'CHO_XU_LY'),
(8,14,DATE_SUB(NOW(),INTERVAL 8 DAY),DATE_SUB(NOW(),INTERVAL 5 DAY),'HUY'),
(9,15,DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_ADD(NOW(),INTERVAL 2 DAY),'CHO_XU_LY'),
(10,5,DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_ADD(NOW(),INTERVAL 1 DAY),'CHO_XU_LY'),
(1,11,DATE_SUB(NOW(),INTERVAL 7 DAY),DATE_SUB(NOW(),INTERVAL 4 DAY),'DA_NHAN');

INSERT INTO nhat_ky_hanh_vi (nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta, thoi_gian) VALUES
(1,'TRA_CUU','SACH',1,'Tra cứu Cơ sở dữ liệu',DATE_SUB(NOW(),INTERVAL 12 DAY)),
(1,'MUON','PHIEU_MUON',1,'Tạo phiếu mượn',DATE_SUB(NOW(),INTERVAL 25 DAY)),
(2,'TRA_CUU','SACH',2,'Tra cứu Hệ quản trị CSDL',DATE_SUB(NOW(),INTERVAL 6 DAY)),
(2,'MUON','PHIEU_MUON',2,'Tạo phiếu mượn',DATE_SUB(NOW(),INTERVAL 5 DAY)),
(3,'TRA','PHIEU_MUON',3,'Hoàn tất trả sách',DATE_SUB(NOW(),INTERVAL 25 DAY)),
(4,'MUON','PHIEU_MUON',4,'Tạo phiếu mượn',DATE_SUB(NOW(),INTERVAL 18 DAY)),
(5,'VI_PHAM','CT_PHIEU_MUON',5,'Trả quá hạn và hư hỏng',DATE_SUB(NOW(),INTERVAL 44 DAY)),
(6,'MUON','PHIEU_MUON',6,'Tạo phiếu mượn',DATE_SUB(NOW(),INTERVAL 8 DAY)),
(8,'MUON','PHIEU_MUON',7,'Tạo phiếu mượn',DATE_SUB(NOW(),INTERVAL 3 DAY)),
(9,'TRA','PHIEU_MUON',8,'Hoàn tất trả sách',DATE_SUB(NOW(),INTERVAL 20 DAY)),
(10,'MUON','PHIEU_MUON',9,'Tạo phiếu mượn',DATE_SUB(NOW(),INTERVAL 12 DAY)),
(1,'VI_PHAM','CT_PHIEU_MUON',10,'Làm mất sách',DATE_SUB(NOW(),INTERVAL 70 DAY)),
(2,'GIA_HAN','CT_PHIEU_MUON',8,'Gia hạn mượn sách',DATE_SUB(NOW(),INTERVAL 25 DAY)),
(3,'DAT_TRUOC','SACH',8,'Đặt trước sách',DATE_SUB(NOW(),INTERVAL 5 DAY)),
(4,'TRA_CUU','SACH',14,'Tra cứu Clean Code',DATE_SUB(NOW(),INTERVAL 1 DAY));

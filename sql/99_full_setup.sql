-- 00. DATABASE
DROP DATABASE IF EXISTS qltv_nhom8;
CREATE DATABASE qltv_nhom8
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
USE qltv_nhom8;


USE qltv_nhom8;

-- 01. TABLES
CREATE TABLE the_loai (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_the_loai VARCHAR(20) NOT NULL UNIQUE,
    ten_the_loai VARCHAR(120) NOT NULL,
    mo_ta VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE nha_xuat_ban (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_nxb VARCHAR(20) NOT NULL UNIQUE,
    ten_nxb VARCHAR(160) NOT NULL,
    dia_chi VARCHAR(255),
    email VARCHAR(120),
    sdt VARCHAR(20)
) ENGINE=InnoDB;

CREATE TABLE tac_gia (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_tac_gia VARCHAR(20) NOT NULL UNIQUE,
    ten_tac_gia VARCHAR(160) NOT NULL,
    quoc_tich VARCHAR(80),
    nam_sinh SMALLINT
) ENGINE=InnoDB;

CREATE TABLE nguoi_dung (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_nguoi_dung VARCHAR(20) NOT NULL UNIQUE,
    ho_ten VARCHAR(160) NOT NULL,
    loai_nguoi_dung VARCHAR(20) NOT NULL,
    email VARCHAR(120) UNIQUE,
    sdt VARCHAR(20),
    khoa_don_vi VARCHAR(160),
    trang_thai VARCHAR(20) NOT NULL DEFAULT 'HOAT_DONG',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_nd_loai CHECK (loai_nguoi_dung IN ('SINH_VIEN','GIANG_VIEN','CAN_BO')),
    CONSTRAINT chk_nd_trang_thai CHECK (trang_thai IN ('HOAT_DONG','TAM_KHOA','NGUNG'))
) ENGINE=InnoDB;

CREATE TABLE tai_khoan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nguoi_dung_id BIGINT NOT NULL UNIQUE,
    ten_dang_nhap VARCHAR(80) NOT NULL UNIQUE,
    mat_khau_hash VARCHAR(255) NOT NULL,
    vai_tro VARCHAR(20) NOT NULL,
    trang_thai VARCHAR(20) NOT NULL DEFAULT 'HOAT_DONG',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tk_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung(id),
    CONSTRAINT chk_tk_vai_tro CHECK (vai_tro IN ('ADMIN','THU_THU','BAN_DOC')),
    CONSTRAINT chk_tk_trang_thai CHECK (trang_thai IN ('HOAT_DONG','KHOA'))
) ENGINE=InnoDB;

CREATE TABLE sach (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_sach VARCHAR(20) NOT NULL UNIQUE,
    isbn VARCHAR(20) UNIQUE,
    ten_sach VARCHAR(255) NOT NULL,
    the_loai_id BIGINT NOT NULL,
    nxb_id BIGINT NOT NULL,
    nam_xuat_ban SMALLINT,
    ngon_ngu VARCHAR(50) DEFAULT 'Tieng Viet',
    mo_ta TEXT,
    CONSTRAINT fk_sach_the_loai FOREIGN KEY (the_loai_id) REFERENCES the_loai(id),
    CONSTRAINT fk_sach_nxb FOREIGN KEY (nxb_id) REFERENCES nha_xuat_ban(id)
) ENGINE=InnoDB;

CREATE TABLE sach_tac_gia (
    sach_id BIGINT NOT NULL,
    tac_gia_id BIGINT NOT NULL,
    PRIMARY KEY (sach_id, tac_gia_id),
    CONSTRAINT fk_stg_sach FOREIGN KEY (sach_id) REFERENCES sach(id),
    CONSTRAINT fk_stg_tac_gia FOREIGN KEY (tac_gia_id) REFERENCES tac_gia(id)
) ENGINE=InnoDB;

CREATE TABLE ban_sach (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_ban_sach VARCHAR(30) NOT NULL UNIQUE,
    sach_id BIGINT NOT NULL,
    vi_tri_ke VARCHAR(50) NOT NULL,
    ngay_nhap DATE NOT NULL,
    tinh_trang VARCHAR(20) NOT NULL DEFAULT 'SAN_SANG',
    CONSTRAINT fk_bs_sach FOREIGN KEY (sach_id) REFERENCES sach(id),
    CONSTRAINT chk_bs_tinh_trang CHECK (tinh_trang IN ('SAN_SANG','DANG_MUON','HU_HONG','MAT','NGUNG_PHUC_VU'))
) ENGINE=InnoDB;

CREATE TABLE phieu_muon (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_phieu VARCHAR(20) UNIQUE,
    nguoi_dung_id BIGINT NOT NULL,
    nhan_vien_id BIGINT,
    ngay_muon DATE NOT NULL DEFAULT (CURRENT_DATE),
    trang_thai VARCHAR(20) NOT NULL DEFAULT 'DANG_MUON',
    CONSTRAINT fk_pm_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung(id),
    CONSTRAINT fk_pm_nhan_vien FOREIGN KEY (nhan_vien_id) REFERENCES nguoi_dung(id),
    CONSTRAINT chk_pm_trang_thai CHECK (trang_thai IN ('DANG_MUON','HOAN_TAT','HUY'))
) ENGINE=InnoDB;

CREATE TABLE ct_phieu_muon (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    phieu_muon_id BIGINT NOT NULL,
    ban_sach_id BIGINT NOT NULL,
    han_tra DATE NOT NULL,
    ngay_tra DATE,
    so_lan_gia_han TINYINT NOT NULL DEFAULT 0,
    tinh_trang_tra VARCHAR(20),
    CONSTRAINT uq_ctpm UNIQUE (phieu_muon_id, ban_sach_id),
    CONSTRAINT fk_ctpm_phieu FOREIGN KEY (phieu_muon_id) REFERENCES phieu_muon(id),
    CONSTRAINT fk_ctpm_ban_sach FOREIGN KEY (ban_sach_id) REFERENCES ban_sach(id),
    CONSTRAINT chk_ctpm_gia_han CHECK (so_lan_gia_han BETWEEN 0 AND 1),
    CONSTRAINT chk_ctpm_tinh_trang_tra CHECK (tinh_trang_tra IS NULL OR tinh_trang_tra IN ('BINH_THUONG','HU_HONG','MAT'))
) ENGINE=InnoDB;

CREATE TABLE phieu_phat (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ct_phieu_muon_id BIGINT NOT NULL,
    loai_phat VARCHAR(20) NOT NULL,
    so_tien DECIMAL(12,2) NOT NULL,
    ly_do VARCHAR(255),
    trang_thai VARCHAR(20) NOT NULL DEFAULT 'CHUA_THANH_TOAN',
    ngay_tao DATE NOT NULL DEFAULT (CURRENT_DATE),
    ngay_thanh_toan DATE,
    CONSTRAINT fk_pp_ctpm FOREIGN KEY (ct_phieu_muon_id) REFERENCES ct_phieu_muon(id),
    CONSTRAINT chk_pp_loai CHECK (loai_phat IN ('QUA_HAN','HU_HONG','MAT_SACH')),
    CONSTRAINT chk_pp_tien CHECK (so_tien >= 0),
    CONSTRAINT chk_pp_trang_thai CHECK (trang_thai IN ('CHUA_THANH_TOAN','DA_THANH_TOAN','HUY'))
) ENGINE=InnoDB;

CREATE TABLE dat_truoc (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nguoi_dung_id BIGINT NOT NULL,
    sach_id BIGINT NOT NULL,
    ngay_dat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    han_giu DATETIME,
    trang_thai VARCHAR(20) NOT NULL DEFAULT 'CHO_XU_LY',
    CONSTRAINT fk_dt_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung(id),
    CONSTRAINT fk_dt_sach FOREIGN KEY (sach_id) REFERENCES sach(id),
    CONSTRAINT chk_dt_trang_thai CHECK (trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN','DA_NHAN','HUY','HET_HAN'))
) ENGINE=InnoDB;

CREATE TABLE nhat_ky_hanh_vi (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nguoi_dung_id BIGINT,
    loai_hanh_vi VARCHAR(30) NOT NULL,
    doi_tuong VARCHAR(50),
    doi_tuong_id BIGINT,
    mo_ta VARCHAR(255),
    thoi_gian DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_nkhv_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung(id)
) ENGINE=InnoDB;

CREATE INDEX idx_sach_ten ON sach(ten_sach);
CREATE INDEX idx_bs_tinh_trang ON ban_sach(tinh_trang);
CREATE INDEX idx_ctpm_han_tra ON ct_phieu_muon(han_tra, ngay_tra);
CREATE INDEX idx_pp_trang_thai ON phieu_phat(trang_thai);
CREATE INDEX idx_dt_trang_thai ON dat_truoc(trang_thai);


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


USE qltv_nhom8;

-- 03. FUNCTIONS
DELIMITER $$

DROP FUNCTION IF EXISTS fn_so_ngay_qua_han$$
CREATE FUNCTION fn_so_ngay_qua_han(p_han_tra DATE, p_ngay_tra DATE)
RETURNS INT
DETERMINISTIC
BEGIN
    RETURN GREATEST(DATEDIFF(COALESCE(p_ngay_tra, CURDATE()), p_han_tra), 0);
END$$

DROP FUNCTION IF EXISTS fn_tien_phat_qua_han$$
CREATE FUNCTION fn_tien_phat_qua_han(p_han_tra DATE, p_ngay_tra DATE)
RETURNS DECIMAL(12,2)
DETERMINISTIC
BEGIN
    RETURN fn_so_ngay_qua_han(p_han_tra, p_ngay_tra) * 5000;
END$$

DROP FUNCTION IF EXISTS fn_co_the_muon$$
CREATE FUNCTION fn_co_the_muon(p_nguoi_dung_id BIGINT)
RETURNS TINYINT
READS SQL DATA
BEGIN
    DECLARE v_trang_thai VARCHAR(20);
    DECLARE v_dang_muon INT DEFAULT 0;
    DECLARE v_no_phat DECIMAL(12,2) DEFAULT 0;

    SELECT trang_thai INTO v_trang_thai
    FROM nguoi_dung
    WHERE id = p_nguoi_dung_id;

    SELECT COUNT(*) INTO v_dang_muon
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE p.nguoi_dung_id = p_nguoi_dung_id
      AND c.ngay_tra IS NULL;

    SELECT COALESCE(SUM(pp.so_tien),0) INTO v_no_phat
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE p.nguoi_dung_id = p_nguoi_dung_id
      AND pp.trang_thai = 'CHUA_THANH_TOAN';

    RETURN IF(v_trang_thai = 'HOAT_DONG' AND v_dang_muon < 5 AND v_no_phat = 0, 1, 0);
END$$

DELIMITER ;


USE qltv_nhom8;

-- 04. PROCEDURES
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_tao_phieu_muon$$
CREATE PROCEDURE sp_tao_phieu_muon(
    IN p_ma_nguoi_dung VARCHAR(20),
    IN p_ma_nhan_vien VARCHAR(20),
    OUT p_ma_phieu VARCHAR(20)
)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_nhan_vien_id BIGINT;
    DECLARE v_id BIGINT;

    SELECT id INTO v_nguoi_dung_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nguoi_dung;

    SELECT id INTO v_nhan_vien_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nhan_vien
      AND loai_nguoi_dung = 'CAN_BO';

    IF fn_co_the_muon(v_nguoi_dung_id) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong du dieu kien muon';
    END IF;

    INSERT INTO phieu_muon(nguoi_dung_id, nhan_vien_id, ngay_muon, trang_thai)
    VALUES(v_nguoi_dung_id, v_nhan_vien_id, CURDATE(), 'DANG_MUON');

    SET v_id = LAST_INSERT_ID();
    SET p_ma_phieu = CONCAT('PM', LPAD(v_id, 6, '0'));

    UPDATE phieu_muon
    SET ma_phieu = p_ma_phieu
    WHERE id = v_id;
END$$

DROP PROCEDURE IF EXISTS sp_them_sach_vao_phieu$$
CREATE PROCEDURE sp_them_sach_vao_phieu(
    IN p_ma_phieu VARCHAR(20),
    IN p_ma_ban_sach VARCHAR(30)
)
BEGIN
    DECLARE v_phieu_id BIGINT;
    DECLARE v_ban_sach_id BIGINT;

    SELECT id INTO v_phieu_id
    FROM phieu_muon
    WHERE ma_phieu = p_ma_phieu;

    SELECT id INTO v_ban_sach_id
    FROM ban_sach
    WHERE ma_ban_sach = p_ma_ban_sach;

    INSERT INTO ct_phieu_muon(phieu_muon_id, ban_sach_id, han_tra)
    VALUES(v_phieu_id, v_ban_sach_id, DATE_ADD(CURDATE(), INTERVAL 14 DAY));
END$$

DROP PROCEDURE IF EXISTS sp_tra_sach$$
CREATE PROCEDURE sp_tra_sach(
    IN p_ct_phieu_muon_id BIGINT,
    IN p_tinh_trang_tra VARCHAR(20)
)
BEGIN
    UPDATE ct_phieu_muon
    SET ngay_tra = CURDATE(),
        tinh_trang_tra = p_tinh_trang_tra
    WHERE id = p_ct_phieu_muon_id
      AND ngay_tra IS NULL;

    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chi tiet muon khong hop le hoac da tra';
    END IF;
END$$

DROP PROCEDURE IF EXISTS sp_gia_han$$
CREATE PROCEDURE sp_gia_han(
    IN p_ct_phieu_muon_id BIGINT,
    IN p_so_ngay INT
)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    IF p_so_ngay < 1 OR p_so_ngay > 7 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'So ngay gia han khong hop le';
    END IF;

    SELECT p.nguoi_dung_id INTO v_nguoi_dung_id
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE c.id = p_ct_phieu_muon_id
      AND c.ngay_tra IS NULL
      AND c.so_lan_gia_han = 0;

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong the gia han';
    END IF;

    UPDATE ct_phieu_muon
    SET han_tra = DATE_ADD(han_tra, INTERVAL p_so_ngay DAY),
        so_lan_gia_han = so_lan_gia_han + 1
    WHERE id = p_ct_phieu_muon_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'GIA_HAN', 'CT_PHIEU_MUON', p_ct_phieu_muon_id, 'Gia han muon sach');
END$$

DROP PROCEDURE IF EXISTS sp_dat_truoc$$
CREATE PROCEDURE sp_dat_truoc(
    IN p_ma_nguoi_dung VARCHAR(20),
    IN p_ma_sach VARCHAR(20)
)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_sach_id BIGINT;

    SELECT id INTO v_nguoi_dung_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nguoi_dung;

    SELECT id INTO v_sach_id
    FROM sach
    WHERE ma_sach = p_ma_sach;

    INSERT INTO dat_truoc(nguoi_dung_id, sach_id, han_giu, trang_thai)
    VALUES(v_nguoi_dung_id, v_sach_id, DATE_ADD(NOW(), INTERVAL 3 DAY), 'CHO_XU_LY');

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'DAT_TRUOC', 'SACH', v_sach_id, 'Dat truoc sach');
END$$

DELIMITER ;


USE qltv_nhom8;

-- 05. TRIGGERS
DELIMITER $$

DROP TRIGGER IF EXISTS trg_ctpm_bi$$
CREATE TRIGGER trg_ctpm_bi
BEFORE INSERT ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_tinh_trang VARCHAR(20);
    DECLARE v_nguoi_dung_id BIGINT;

    SELECT tinh_trang INTO v_tinh_trang
    FROM ban_sach
    WHERE id = NEW.ban_sach_id;

    SELECT nguoi_dung_id INTO v_nguoi_dung_id
    FROM phieu_muon
    WHERE id = NEW.phieu_muon_id
      AND trang_thai = 'DANG_MUON';

    IF v_tinh_trang <> 'SAN_SANG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach khong san sang';
    END IF;

    IF v_nguoi_dung_id IS NULL OR fn_co_the_muon(v_nguoi_dung_id) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong du dieu kien muon';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ctpm_ai$$
CREATE TRIGGER trg_ctpm_ai
AFTER INSERT ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    UPDATE ban_sach
    SET tinh_trang = 'DANG_MUON'
    WHERE id = NEW.ban_sach_id;

    SELECT nguoi_dung_id INTO v_nguoi_dung_id
    FROM phieu_muon
    WHERE id = NEW.phieu_muon_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'MUON', 'CT_PHIEU_MUON', NEW.id, 'Muon ban sach');
END$$

DROP TRIGGER IF EXISTS trg_ctpm_au$$
CREATE TRIGGER trg_ctpm_au
AFTER UPDATE ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    IF OLD.ngay_tra IS NULL AND NEW.ngay_tra IS NOT NULL THEN
        UPDATE ban_sach
        SET tinh_trang = CASE
            WHEN NEW.tinh_trang_tra = 'HU_HONG' THEN 'HU_HONG'
            WHEN NEW.tinh_trang_tra = 'MAT' THEN 'MAT'
            ELSE 'SAN_SANG'
        END
        WHERE id = NEW.ban_sach_id;

        IF fn_so_ngay_qua_han(NEW.han_tra, NEW.ngay_tra) > 0 THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'QUA_HAN', fn_tien_phat_qua_han(NEW.han_tra, NEW.ngay_tra), 'Tra sach qua han');
        END IF;

        IF NEW.tinh_trang_tra = 'HU_HONG' THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'HU_HONG', 50000, 'Sach hu hong khi tra');
        END IF;

        IF NEW.tinh_trang_tra = 'MAT' THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'MAT_SACH', 300000, 'Mat sach');
        END IF;

        SELECT nguoi_dung_id INTO v_nguoi_dung_id
        FROM phieu_muon
        WHERE id = NEW.phieu_muon_id;

        INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
        VALUES(v_nguoi_dung_id, 'TRA', 'CT_PHIEU_MUON', NEW.id, 'Tra sach');
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_dat_truoc_bi$$
CREATE TRIGGER trg_dat_truoc_bi
BEFORE INSERT ON dat_truoc
FOR EACH ROW
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_trang_thai VARCHAR(20);

    SELECT trang_thai INTO v_trang_thai
    FROM nguoi_dung
    WHERE id = NEW.nguoi_dung_id;

    SELECT COUNT(*) INTO v_count
    FROM dat_truoc
    WHERE nguoi_dung_id = NEW.nguoi_dung_id
      AND sach_id = NEW.sach_id
      AND trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN');

    IF v_trang_thai <> 'HOAT_DONG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong hoat dong';
    END IF;

    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Da co dat truoc dang hoat dong';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_phieu_phat_bu$$
CREATE TRIGGER trg_phieu_phat_bu
BEFORE UPDATE ON phieu_phat
FOR EACH ROW
BEGIN
    IF OLD.trang_thai <> 'DA_THANH_TOAN' AND NEW.trang_thai = 'DA_THANH_TOAN' THEN
        SET NEW.ngay_thanh_toan = COALESCE(NEW.ngay_thanh_toan, CURDATE());
    END IF;
END$$

DELIMITER ;


USE qltv_nhom8;

-- 06. CURSORS
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_cursor_danh_dau_qua_han$$
CREATE PROCEDURE sp_cursor_danh_dau_qua_han()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_ct_id BIGINT;
    DECLARE v_nguoi_dung_id BIGINT;

    DECLARE cur CURSOR FOR
        SELECT c.id, p.nguoi_dung_id
        FROM ct_phieu_muon c
        JOIN phieu_muon p ON p.id = c.phieu_muon_id
        WHERE c.ngay_tra IS NULL
          AND c.han_tra < CURDATE();

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_ct_id, v_nguoi_dung_id;

        IF done = 1 THEN
            LEAVE read_loop;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM nhat_ky_hanh_vi
            WHERE nguoi_dung_id = v_nguoi_dung_id
              AND loai_hanh_vi = 'VI_PHAM'
              AND doi_tuong = 'CT_PHIEU_MUON'
              AND doi_tuong_id = v_ct_id
              AND DATE(thoi_gian) = CURDATE()
        ) THEN
            INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
            VALUES(v_nguoi_dung_id, 'VI_PHAM', 'CT_PHIEU_MUON', v_ct_id, 'Qua han muon sach');
        END IF;
    END LOOP;

    CLOSE cur;
END$$

DROP PROCEDURE IF EXISTS sp_cursor_thong_ke_muon_theo_nguoi_dung$$
CREATE PROCEDURE sp_cursor_thong_ke_muon_theo_nguoi_dung()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_id BIGINT;
    DECLARE v_ma VARCHAR(20);
    DECLARE v_ten VARCHAR(160);
    DECLARE v_so_luot INT;

    DECLARE cur CURSOR FOR
        SELECT id, ma_nguoi_dung, ho_ten
        FROM nguoi_dung
        WHERE loai_nguoi_dung IN ('SINH_VIEN','GIANG_VIEN');

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    DROP TEMPORARY TABLE IF EXISTS tmp_thong_ke_muon;
    CREATE TEMPORARY TABLE tmp_thong_ke_muon (
        ma_nguoi_dung VARCHAR(20),
        ho_ten VARCHAR(160),
        so_luot_muon INT
    );

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_id, v_ma, v_ten;

        IF done = 1 THEN
            LEAVE read_loop;
        END IF;

        SELECT COUNT(*) INTO v_so_luot
        FROM phieu_muon
        WHERE nguoi_dung_id = v_id;

        INSERT INTO tmp_thong_ke_muon
        VALUES(v_ma, v_ten, v_so_luot);
    END LOOP;

    CLOSE cur;

    SELECT *
    FROM tmp_thong_ke_muon
    ORDER BY so_luot_muon DESC, ma_nguoi_dung;
END$$

DELIMITER ;


USE qltv_nhom8;

-- 07. REPORTS
CREATE OR REPLACE VIEW vw_danh_muc_sach AS
SELECT
    s.ma_sach,
    s.ten_sach,
    tl.ten_the_loai,
    nxb.ten_nxb,
    s.nam_xuat_ban,
    COUNT(bs.id) AS tong_so_ban,
    SUM(bs.tinh_trang = 'SAN_SANG') AS so_ban_san_sang
FROM sach s
JOIN the_loai tl ON tl.id = s.the_loai_id
JOIN nha_xuat_ban nxb ON nxb.id = s.nxb_id
LEFT JOIN ban_sach bs ON bs.sach_id = s.id
GROUP BY s.id, s.ma_sach, s.ten_sach, tl.ten_the_loai, nxb.ten_nxb, s.nam_xuat_ban;

CREATE OR REPLACE VIEW vw_sach_dang_muon AS
SELECT
    p.ma_phieu,
    nd.ma_nguoi_dung,
    nd.ho_ten,
    bs.ma_ban_sach,
    s.ma_sach,
    s.ten_sach,
    p.ngay_muon,
    c.han_tra
FROM ct_phieu_muon c
JOIN phieu_muon p ON p.id = c.phieu_muon_id
JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
JOIN ban_sach bs ON bs.id = c.ban_sach_id
JOIN sach s ON s.id = bs.sach_id
WHERE c.ngay_tra IS NULL;

CREATE OR REPLACE VIEW vw_muon_qua_han AS
SELECT
    p.ma_phieu,
    nd.ma_nguoi_dung,
    nd.ho_ten,
    s.ten_sach,
    c.han_tra,
    fn_so_ngay_qua_han(c.han_tra, c.ngay_tra) AS so_ngay_qua_han,
    fn_tien_phat_qua_han(c.han_tra, c.ngay_tra) AS tien_phat_tam_tinh
FROM ct_phieu_muon c
JOIN phieu_muon p ON p.id = c.phieu_muon_id
JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
JOIN ban_sach bs ON bs.id = c.ban_sach_id
JOIN sach s ON s.id = bs.sach_id
WHERE c.ngay_tra IS NULL
  AND c.han_tra < CURDATE();

CREATE OR REPLACE VIEW vw_nguoi_dung_vi_pham AS
SELECT
    nd.ma_nguoi_dung,
    nd.ho_ten,
    COUNT(pp.id) AS so_lan_phat,
    SUM(pp.so_tien) AS tong_tien_phat,
    SUM(CASE WHEN pp.trang_thai = 'CHUA_THANH_TOAN' THEN pp.so_tien ELSE 0 END) AS con_no
FROM phieu_phat pp
JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
JOIN phieu_muon p ON p.id = c.phieu_muon_id
JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
WHERE pp.trang_thai <> 'HUY'
GROUP BY nd.id, nd.ma_nguoi_dung, nd.ho_ten;

CREATE OR REPLACE VIEW vw_top_sach_muon_nhieu AS
SELECT
    s.ma_sach,
    s.ten_sach,
    COUNT(c.id) AS so_luot_muon
FROM ct_phieu_muon c
JOIN ban_sach bs ON bs.id = c.ban_sach_id
JOIN sach s ON s.id = bs.sach_id
GROUP BY s.id, s.ma_sach, s.ten_sach
ORDER BY so_luot_muon DESC, s.ma_sach;


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


USE qltv_nhom8;

-- 09. SMOKE TEST
SELECT COUNT(*) AS so_the_loai FROM the_loai;
SELECT COUNT(*) AS so_sach FROM sach;
SELECT COUNT(*) AS so_ban_sach FROM ban_sach;
SELECT COUNT(*) AS so_nguoi_dung FROM nguoi_dung;
SELECT * FROM vw_danh_muc_sach ORDER BY ma_sach;
SELECT * FROM vw_sach_dang_muon;
SELECT * FROM vw_muon_qua_han;
SELECT * FROM vw_nguoi_dung_vi_pham;
SELECT * FROM vw_top_sach_muon_nhieu LIMIT 10;

SELECT fn_so_ngay_qua_han(DATE_SUB(CURDATE(), INTERVAL 3 DAY), CURDATE()) AS test_so_ngay_qua_han;
SELECT fn_tien_phat_qua_han(DATE_SUB(CURDATE(), INTERVAL 3 DAY), CURDATE()) AS test_tien_phat;

CALL sp_cursor_thong_ke_muon_theo_nguoi_dung();

-- 99. FULL SETUP: ghép 00..08 (không gồm 09_smoke_test.sql và 08b_create_users.sql)

-- ===== 00_database.sql =====
-- 00. DATABASE
DROP DATABASE IF EXISTS qltv_nhom8;
CREATE DATABASE qltv_nhom8
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
USE qltv_nhom8;

-- ===== 01_schema.sql =====
USE qltv_nhom8;

-- 01. TABLES

-- Tham số nghiệp vụ (thay cho các hằng số hard-code trong function/procedure/trigger)
CREATE TABLE tham_so (
    ma_tham_so VARCHAR(40) PRIMARY KEY,
    gia_tri DECIMAL(12,2) NOT NULL,
    don_vi VARCHAR(20),
    mo_ta VARCHAR(255),
    CONSTRAINT chk_ts_gia_tri CHECK (gia_tri >= 0)
) ENGINE=InnoDB;

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
    sdt VARCHAR(20),
    CONSTRAINT chk_nxb_email CHECK (email IS NULL OR email LIKE '%_@_%._%')
) ENGINE=InnoDB;

CREATE TABLE tac_gia (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_tac_gia VARCHAR(20) NOT NULL UNIQUE,
    ten_tac_gia VARCHAR(160) NOT NULL,
    quoc_tich VARCHAR(80),
    nam_sinh SMALLINT,
    CONSTRAINT chk_tg_nam_sinh CHECK (nam_sinh IS NULL OR nam_sinh BETWEEN 1000 AND 2100)
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
    CONSTRAINT chk_nd_trang_thai CHECK (trang_thai IN ('HOAT_DONG','TAM_KHOA','NGUNG')),
    CONSTRAINT chk_nd_email CHECK (email IS NULL OR email LIKE '%_@_%._%')
) ENGINE=InnoDB;

-- mat_khau_hash = SHA2(CONCAT(muoi, mat_khau), 256). Đây chỉ là cơ chế demo trong CSDL;
-- ứng dụng thật nên băm bằng bcrypt/argon2 ở tầng ứng dụng rồi lưu vào cột mat_khau_hash.
CREATE TABLE tai_khoan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nguoi_dung_id BIGINT NOT NULL UNIQUE,
    ten_dang_nhap VARCHAR(80) NOT NULL UNIQUE,
    muoi CHAR(32) NOT NULL,
    mat_khau_hash VARCHAR(255) NOT NULL,
    vai_tro VARCHAR(20) NOT NULL,
    trang_thai VARCHAR(20) NOT NULL DEFAULT 'HOAT_DONG',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tk_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung(id),
    CONSTRAINT chk_tk_vai_tro CHECK (vai_tro IN ('ADMIN','THU_THU','BAN_DOC')),
    CONSTRAINT chk_tk_trang_thai CHECK (trang_thai IN ('HOAT_DONG','KHOA'))
) ENGINE=InnoDB;

-- gia_bia: giá bìa (NULL nếu chưa biết); dùng để tính tiền đền khi mất sách (xem fn_tien_phat_mat_sach).
CREATE TABLE sach (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_sach VARCHAR(20) NOT NULL UNIQUE,
    isbn VARCHAR(20) UNIQUE,
    ten_sach VARCHAR(255) NOT NULL,
    the_loai_id BIGINT NOT NULL,
    nxb_id BIGINT NOT NULL,
    nam_xuat_ban SMALLINT,
    ngon_ngu VARCHAR(50) NOT NULL DEFAULT 'Tiếng Việt',
    gia_bia DECIMAL(12,2),
    mo_ta TEXT,
    CONSTRAINT fk_sach_the_loai FOREIGN KEY (the_loai_id) REFERENCES the_loai(id),
    CONSTRAINT fk_sach_nxb FOREIGN KEY (nxb_id) REFERENCES nha_xuat_ban(id),
    CONSTRAINT chk_sach_nam_xb CHECK (nam_xuat_ban IS NULL OR nam_xuat_ban BETWEEN 1450 AND 2100),
    CONSTRAINT chk_sach_gia_bia CHECK (gia_bia IS NULL OR gia_bia >= 0),
    CONSTRAINT chk_sach_ngon_ngu CHECK (ngon_ngu IN ('Tiếng Việt','English','Français','日本語','中文','Khác'))
) ENGINE=InnoDB;

CREATE TABLE sach_tac_gia (
    sach_id BIGINT NOT NULL,
    tac_gia_id BIGINT NOT NULL,
    PRIMARY KEY (sach_id, tac_gia_id),
    CONSTRAINT fk_stg_sach FOREIGN KEY (sach_id) REFERENCES sach(id),
    CONSTRAINT fk_stg_tac_gia FOREIGN KEY (tac_gia_id) REFERENCES tac_gia(id)
) ENGINE=InnoDB;

-- DANG_GIU: bản sách đang được giữ cho một lượt đặt trước (dat_truoc.trang_thai = SAN_SANG_NHAN)
CREATE TABLE ban_sach (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_ban_sach VARCHAR(30) NOT NULL UNIQUE,
    sach_id BIGINT NOT NULL,
    vi_tri_ke VARCHAR(50) NOT NULL,
    ngay_nhap DATE NOT NULL,
    tinh_trang VARCHAR(20) NOT NULL DEFAULT 'SAN_SANG',
    CONSTRAINT fk_bs_sach FOREIGN KEY (sach_id) REFERENCES sach(id),
    CONSTRAINT chk_bs_tinh_trang CHECK (tinh_trang IN ('SAN_SANG','DANG_MUON','DANG_GIU','HU_HONG','MAT','NGUNG_PHUC_VU'))
) ENGINE=InnoDB;

-- nhan_vien_id bắt buộc và phải là CAN_BO (kiểm tra bởi trigger trg_phieu_muon_bi)
CREATE TABLE phieu_muon (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_phieu VARCHAR(20) UNIQUE,
    nguoi_dung_id BIGINT NOT NULL,
    nhan_vien_id BIGINT NOT NULL,
    ngay_muon DATE NOT NULL DEFAULT (CURRENT_DATE),
    trang_thai VARCHAR(20) NOT NULL DEFAULT 'DANG_MUON',
    CONSTRAINT fk_pm_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung(id),
    CONSTRAINT fk_pm_nhan_vien FOREIGN KEY (nhan_vien_id) REFERENCES nguoi_dung(id),
    CONSTRAINT chk_pm_trang_thai CHECK (trang_thai IN ('DANG_MUON','HOAN_TAT','HUY'))
) ENGINE=InnoDB;

-- ban_sach_dang_muon: cột sinh tự động, chỉ có giá trị khi chưa trả.
-- UNIQUE trên cột này bảo đảm mỗi bản sách chỉ có tối đa 1 lượt mượn đang mở (chống mượn trùng khi chạy đồng thời).
CREATE TABLE ct_phieu_muon (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    phieu_muon_id BIGINT NOT NULL,
    ban_sach_id BIGINT NOT NULL,
    han_tra DATE NOT NULL,
    ngay_tra DATE,
    so_lan_gia_han TINYINT NOT NULL DEFAULT 0,
    tinh_trang_tra VARCHAR(20),
    ban_sach_dang_muon BIGINT GENERATED ALWAYS AS (IF(ngay_tra IS NULL, ban_sach_id, NULL)) STORED,
    CONSTRAINT uq_ctpm UNIQUE (phieu_muon_id, ban_sach_id),
    CONSTRAINT uq_ctpm_dang_muon UNIQUE (ban_sach_dang_muon),
    CONSTRAINT fk_ctpm_phieu FOREIGN KEY (phieu_muon_id) REFERENCES phieu_muon(id),
    CONSTRAINT fk_ctpm_ban_sach FOREIGN KEY (ban_sach_id) REFERENCES ban_sach(id),
    CONSTRAINT chk_ctpm_gia_han CHECK (so_lan_gia_han >= 0), -- giới hạn thật nằm ở tham số SO_LAN_GIA_HAN_TOI_DA
    CONSTRAINT chk_ctpm_tinh_trang_tra CHECK (tinh_trang_tra IS NULL OR tinh_trang_tra IN ('BINH_THUONG','HU_HONG','MAT')),
    CONSTRAINT chk_ctpm_ngay_tra_tinh_trang CHECK ((ngay_tra IS NULL) = (tinh_trang_tra IS NULL))
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
    CONSTRAINT uq_pp_ct_loai UNIQUE (ct_phieu_muon_id, loai_phat),
    CONSTRAINT fk_pp_ctpm FOREIGN KEY (ct_phieu_muon_id) REFERENCES ct_phieu_muon(id),
    CONSTRAINT chk_pp_loai CHECK (loai_phat IN ('QUA_HAN','HU_HONG','MAT_SACH')),
    CONSTRAINT chk_pp_tien CHECK (so_tien >= 0),
    CONSTRAINT chk_pp_trang_thai CHECK (trang_thai IN ('CHUA_THANH_TOAN','DA_THANH_TOAN','HUY')),
    CONSTRAINT chk_pp_thanh_toan CHECK (trang_thai <> 'DA_THANH_TOAN' OR ngay_thanh_toan IS NOT NULL)
) ENGINE=InnoDB;

-- Vòng đời: CHO_XU_LY -> SAN_SANG_NHAN (đã giữ ban_sach_id, có han_giu) -> DA_NHAN | HET_HAN | HUY
-- khoa_dang_hoat_dong: mỗi người chỉ có 1 lượt đặt đang hoạt động cho mỗi đầu sách.
-- ban_sach_dang_giu: mỗi bản sách chỉ được giữ cho 1 lượt đặt.
CREATE TABLE dat_truoc (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nguoi_dung_id BIGINT NOT NULL,
    sach_id BIGINT NOT NULL,
    ban_sach_id BIGINT,
    ngay_dat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    han_giu DATETIME,
    trang_thai VARCHAR(20) NOT NULL DEFAULT 'CHO_XU_LY',
    khoa_dang_hoat_dong VARCHAR(50) GENERATED ALWAYS AS
        (IF(trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN'), CONCAT(nguoi_dung_id, '-', sach_id), NULL)) STORED,
    ban_sach_dang_giu BIGINT GENERATED ALWAYS AS
        (IF(trang_thai = 'SAN_SANG_NHAN', ban_sach_id, NULL)) STORED,
    CONSTRAINT uq_dt_dang_hoat_dong UNIQUE (khoa_dang_hoat_dong),
    CONSTRAINT uq_dt_dang_giu UNIQUE (ban_sach_dang_giu),
    CONSTRAINT fk_dt_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung(id),
    CONSTRAINT fk_dt_sach FOREIGN KEY (sach_id) REFERENCES sach(id),
    CONSTRAINT fk_dt_ban_sach FOREIGN KEY (ban_sach_id) REFERENCES ban_sach(id),
    CONSTRAINT chk_dt_trang_thai CHECK (trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN','DA_NHAN','HUY','HET_HAN')),
    CONSTRAINT chk_dt_giu_cho CHECK (trang_thai <> 'SAN_SANG_NHAN' OR (ban_sach_id IS NOT NULL AND han_giu IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE nhat_ky_hanh_vi (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nguoi_dung_id BIGINT,
    loai_hanh_vi VARCHAR(30) NOT NULL,
    doi_tuong VARCHAR(50),
    doi_tuong_id BIGINT,
    mo_ta VARCHAR(255),
    thoi_gian DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_nkhv_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung(id),
    CONSTRAINT chk_nkhv_loai CHECK (loai_hanh_vi IN
        ('TRA_CUU','MUON','TRA','GIA_HAN','DAT_TRUOC','HUY_DAT_TRUOC','GIU_SACH','HET_HAN_DAT_TRUOC',
         'VI_PHAM','THANH_TOAN_PHAT','DOI_TINH_TRANG','HUY_PHIEU_MUON','HUY_PHAT')),
    CONSTRAINT chk_nkhv_doi_tuong CHECK (doi_tuong IS NULL OR doi_tuong IN
        ('CT_PHIEU_MUON','SACH','BAN_SACH','DAT_TRUOC','PHIEU_PHAT','PHIEU_MUON'))
) ENGINE=InnoDB;

CREATE INDEX idx_sach_ten ON sach(ten_sach);
CREATE FULLTEXT INDEX ft_sach_ten_mo_ta ON sach(ten_sach, mo_ta);
CREATE INDEX idx_tac_gia_ten ON tac_gia(ten_tac_gia);
CREATE INDEX idx_bs_tinh_trang ON ban_sach(tinh_trang);
CREATE INDEX idx_bs_sach_tinh_trang ON ban_sach(sach_id, tinh_trang);
CREATE INDEX idx_ctpm_han_tra ON ct_phieu_muon(han_tra, ngay_tra);
CREATE INDEX idx_pp_trang_thai ON phieu_phat(trang_thai);
CREATE INDEX idx_dt_trang_thai ON dat_truoc(trang_thai);
CREATE INDEX idx_dt_hang_doi ON dat_truoc(sach_id, trang_thai, ngay_dat);
CREATE INDEX idx_nkhv_doi_tuong ON nhat_ky_hanh_vi(loai_hanh_vi, doi_tuong, doi_tuong_id, thoi_gian);
CREATE INDEX idx_nkhv_thoi_gian ON nhat_ky_hanh_vi(thoi_gian);

-- ===== 02_seed.sql =====
USE qltv_nhom8;

-- 02. SAMPLE DATA
INSERT INTO tham_so (ma_tham_so, gia_tri, don_vi, mo_ta) VALUES
('SO_NGAY_MUON', 14, 'ngay', 'Thoi han muon mac dinh'),
('SO_SACH_TOI_DA', 5, 'ban', 'So ban sach dang muon toi da moi nguoi dung'),
('SO_NGAY_GIA_HAN_TOI_DA', 7, 'ngay', 'So ngay gia han toi da moi lan'),
('SO_LAN_GIA_HAN_TOI_DA', 1, 'lan', 'So lan gia han toi da moi luot muon'),
('PHAT_QUA_HAN_TOI_DA', 100000, 'VND/luot', 'Tran tien phat qua han moi luot muon'),
('PHAT_QUA_HAN_NGAY', 5000, 'VND/ngay', 'Tien phat qua han moi ngay'),
('PHAT_HU_HONG', 50000, 'VND/lan', 'Tien phat lam hu hong sach'),
('PHAT_MAT_SACH', 300000, 'VND/lan', 'Tien den mat sach toi thieu (lay muc cao hon giua tham so nay va gia bia)'),
('SO_NGAY_GIU_DAT_TRUOC', 3, 'ngay', 'Thoi gian giu sach cho nguoi dat truoc');

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
('CB002','Phạm Thu Trang','CAN_BO','trang.tv@uit.edu.vn','0903000002','Thư viện','HOAT_DONG'),
('AD001','Quản trị hệ thống','CAN_BO','admin.tv@uit.edu.vn','0903000003','Thư viện','HOAT_DONG');

-- Tài khoản DEMO: mỗi tài khoản có muối ngẫu nhiên riêng; mật khẩu demo = <mã người dùng>@Nhom8.
-- Chỉ dùng để trình diễn. Ứng dụng thật phải bắt đổi mật khẩu và băm bằng bcrypt/argon2.
INSERT INTO tai_khoan (nguoi_dung_id, ten_dang_nhap, muoi, mat_khau_hash, vai_tro, trang_thai)
SELECT id, LOWER(ma_nguoi_dung), HEX(RANDOM_BYTES(16)), '',
       CASE WHEN ma_nguoi_dung = 'AD001' THEN 'ADMIN'
            WHEN loai_nguoi_dung = 'CAN_BO' THEN 'THU_THU'
            ELSE 'BAN_DOC' END,
       CASE WHEN trang_thai = 'TAM_KHOA' THEN 'KHOA' ELSE 'HOAT_DONG' END
FROM nguoi_dung;

UPDATE tai_khoan t
JOIN nguoi_dung nd ON nd.id = t.nguoi_dung_id
SET t.mat_khau_hash = SHA2(CONCAT(t.muoi, nd.ma_nguoi_dung, '@Nhom8'), 256);

INSERT INTO sach (ma_sach, isbn, ten_sach, the_loai_id, nxb_id, nam_xuat_ban, ngon_ngu, gia_bia, mo_ta) VALUES
('S001','9786040000019','Cơ sở dữ liệu',4,3,2024,'Tiếng Việt',95000,'Nhập môn CSDL'),
('S002','9786040000026','Hệ quản trị cơ sở dữ liệu',4,3,2023,'Tiếng Việt',110000,'DBMS'),
('S003','9786040000033','Cấu trúc dữ liệu và giải thuật',2,4,2022,'Tiếng Việt',180000,'DSA'),
('S004','9786040000040','Lập trình Java',5,1,2024,'Tiếng Việt',120000,'Java'),
('S005','9786040000057','Lập trình Python',5,2,2025,'Tiếng Việt',105000,'Python'),
('S006','9786040000064','Mạng máy tính căn bản',3,5,2023,'Tiếng Việt',90000,'Networking'),
('S007','9786040000071','An toàn thông tin',1,5,2024,'Tiếng Việt',130000,'Security'),
('S008','9786040000088','Hệ điều hành',1,4,2022,'Tiếng Việt',150000,'Operating Systems'),
('S009','9786040000095','Toán rời rạc',6,8,2021,'Tiếng Việt',98000,'Discrete Math'),
('S010','9786040000101','Đại số tuyến tính',6,8,2023,'Tiếng Việt',85000,'Linear Algebra'),
('S011','9786040000118','English for IT',8,1,2024,'English',140000,'English'),
('S012','9786040000125','Kỹ năng thuyết trình',9,6,2022,'Tiếng Việt',70000,'Soft skills'),
('S013','9786040000132','Quản trị dự án CNTT',7,7,2024,'Tiếng Việt',160000,'IT Project Management'),
('S014','9786040000149','Clean Code',5,2,2020,'English',220000,'Software craftsmanship'),
('S015','9786040000156','Computer Networks',3,4,2021,'English',250000,'Computer networks');

INSERT INTO sach_tac_gia (sach_id, tac_gia_id) VALUES
(1,1),(1,2),(2,3),(3,4),(3,5),(4,6),(5,7),(6,8),(6,12),(7,9),
(8,10),(8,12),(9,1),(10,2),(11,4),(12,5),(13,6),(14,11),(15,12),(15,8);

-- BS012 đang được giữ cho lượt đặt trước số 5 (DANG_GIU)
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
('BS012',10,'B2-02',DATE_SUB(CURDATE(),INTERVAL 200 DAY),'DANG_GIU'),
('BS013',11,'C1-01',DATE_SUB(CURDATE(),INTERVAL 180 DAY),'DANG_MUON'),
('BS014',12,'C1-02',DATE_SUB(CURDATE(),INTERVAL 160 DAY),'SAN_SANG'),
('BS015',13,'C1-03',DATE_SUB(CURDATE(),INTERVAL 140 DAY),'SAN_SANG'),
('BS016',14,'C2-01',DATE_SUB(CURDATE(),INTERVAL 120 DAY),'SAN_SANG'),
('BS017',15,'C2-02',DATE_SUB(CURDATE(),INTERVAL 100 DAY),'DANG_MUON'),
('BS018',3,'A2-01',DATE_SUB(CURDATE(),INTERVAL 90 DAY),'SAN_SANG'),
('BS019',4,'A2-02',DATE_SUB(CURDATE(),INTERVAL 110 DAY),'MAT'),
('BS020',5,'A2-03',DATE_SUB(CURDATE(),INTERVAL 70 DAY),'SAN_SANG');

-- han_tra = ngay_muon + 14 ngày (+ số ngày gia hạn nếu có)
INSERT INTO phieu_muon (ma_phieu, nguoi_dung_id, nhan_vien_id, ngay_muon, trang_thai) VALUES
('PM000001',1,11,DATE_SUB(CURDATE(),INTERVAL 25 DAY),'DANG_MUON'),
('PM000002',2,11,DATE_SUB(CURDATE(),INTERVAL 5 DAY),'DANG_MUON'),
('PM000003',3,12,DATE_SUB(CURDATE(),INTERVAL 40 DAY),'HOAN_TAT'),
('PM000004',4,11,DATE_SUB(CURDATE(),INTERVAL 18 DAY),'DANG_MUON'),
('PM000005',5,12,DATE_SUB(CURDATE(),INTERVAL 60 DAY),'HOAN_TAT'),
('PM000006',6,11,DATE_SUB(CURDATE(),INTERVAL 8 DAY),'DANG_MUON'),
('PM000007',8,12,DATE_SUB(CURDATE(),INTERVAL 3 DAY),'DANG_MUON'),
('PM000008',9,11,DATE_SUB(CURDATE(),INTERVAL 49 DAY),'HOAN_TAT'),
('PM000009',10,12,DATE_SUB(CURDATE(),INTERVAL 12 DAY),'DANG_MUON'),
('PM000010',1,11,DATE_SUB(CURDATE(),INTERVAL 90 DAY),'HOAN_TAT'),
('PM000011',2,12,DATE_SUB(CURDATE(),INTERVAL 70 DAY),'HOAN_TAT'),
('PM000012',3,11,DATE_SUB(CURDATE(),INTERVAL 50 DAY),'HOAN_TAT'),
('PM000013',4,11,DATE_SUB(CURDATE(),INTERVAL 45 DAY),'HOAN_TAT'),
('PM000014',6,12,DATE_SUB(CURDATE(),INTERVAL 30 DAY),'HOAN_TAT'),
('PM000015',9,11,DATE_SUB(CURDATE(),INTERVAL 55 DAY),'HOAN_TAT');

INSERT INTO ct_phieu_muon (phieu_muon_id, ban_sach_id, han_tra, ngay_tra, so_lan_gia_han, tinh_trang_tra) VALUES
(1,1,DATE_SUB(CURDATE(),INTERVAL 11 DAY),NULL,0,NULL),
(2,3,DATE_ADD(CURDATE(),INTERVAL 9 DAY),NULL,0,NULL),
(3,5,DATE_SUB(CURDATE(),INTERVAL 26 DAY),DATE_SUB(CURDATE(),INTERVAL 25 DAY),0,'BINH_THUONG'),
(4,6,DATE_SUB(CURDATE(),INTERVAL 4 DAY),NULL,0,NULL),
(5,10,DATE_SUB(CURDATE(),INTERVAL 46 DAY),DATE_SUB(CURDATE(),INTERVAL 44 DAY),0,'HU_HONG'),
(6,8,DATE_ADD(CURDATE(),INTERVAL 6 DAY),NULL,0,NULL),
(7,13,DATE_ADD(CURDATE(),INTERVAL 11 DAY),NULL,0,NULL),
(8,11,DATE_SUB(CURDATE(),INTERVAL 28 DAY),DATE_SUB(CURDATE(),INTERVAL 27 DAY),1,'BINH_THUONG'),
(9,17,DATE_ADD(CURDATE(),INTERVAL 2 DAY),NULL,0,NULL),
(10,19,DATE_SUB(CURDATE(),INTERVAL 76 DAY),DATE_SUB(CURDATE(),INTERVAL 70 DAY),0,'MAT'),
(11,12,DATE_SUB(CURDATE(),INTERVAL 56 DAY),DATE_SUB(CURDATE(),INTERVAL 55 DAY),0,'BINH_THUONG'),
(12,14,DATE_SUB(CURDATE(),INTERVAL 36 DAY),DATE_SUB(CURDATE(),INTERVAL 36 DAY),0,'BINH_THUONG'),
(3,7,DATE_SUB(CURDATE(),INTERVAL 26 DAY),DATE_SUB(CURDATE(),INTERVAL 26 DAY),0,'BINH_THUONG'),
(5,15,DATE_SUB(CURDATE(),INTERVAL 46 DAY),DATE_SUB(CURDATE(),INTERVAL 46 DAY),0,'BINH_THUONG'),
(8,16,DATE_SUB(CURDATE(),INTERVAL 35 DAY),DATE_SUB(CURDATE(),INTERVAL 35 DAY),0,'BINH_THUONG'),
(13,2,DATE_SUB(CURDATE(),INTERVAL 31 DAY),DATE_SUB(CURDATE(),INTERVAL 28 DAY),0,'BINH_THUONG'),
(14,4,DATE_SUB(CURDATE(),INTERVAL 16 DAY),DATE_SUB(CURDATE(),INTERVAL 14 DAY),0,'BINH_THUONG'),
(15,9,DATE_SUB(CURDATE(),INTERVAL 41 DAY),DATE_SUB(CURDATE(),INTERVAL 38 DAY),0,'BINH_THUONG');

-- Chỉ có phiếu phạt cho các lượt mượn ĐÃ TRẢ (phạt quá hạn tạm tính xem ở vw_muon_qua_han).
INSERT INTO phieu_phat (ct_phieu_muon_id, loai_phat, so_tien, ly_do, trang_thai, ngay_tao, ngay_thanh_toan) VALUES
(3,'QUA_HAN',5000,'Trả trễ 1 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 25 DAY),DATE_SUB(CURDATE(),INTERVAL 24 DAY)),
(5,'QUA_HAN',10000,'Trả trễ 2 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 44 DAY),DATE_SUB(CURDATE(),INTERVAL 40 DAY)),
(5,'HU_HONG',50000,'Sách hư hỏng','CHUA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 44 DAY),NULL),
(8,'QUA_HAN',5000,'Trả trễ 1 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 27 DAY),DATE_SUB(CURDATE(),INTERVAL 26 DAY)),
(10,'QUA_HAN',30000,'Trả trễ 6 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 70 DAY),DATE_SUB(CURDATE(),INTERVAL 65 DAY)),
(10,'MAT_SACH',300000,'Làm mất sách','CHUA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 70 DAY),NULL),
(11,'QUA_HAN',5000,'Trả trễ 1 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 55 DAY),DATE_SUB(CURDATE(),INTERVAL 54 DAY)),
(16,'QUA_HAN',15000,'Trả trễ 3 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 28 DAY),DATE_SUB(CURDATE(),INTERVAL 26 DAY)),
(17,'QUA_HAN',10000,'Trả trễ 2 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 14 DAY),DATE_SUB(CURDATE(),INTERVAL 12 DAY)),
(18,'QUA_HAN',15000,'Trả trễ 3 ngày','DA_THANH_TOAN',DATE_SUB(CURDATE(),INTERVAL 38 DAY),DATE_SUB(CURDATE(),INTERVAL 36 DAY));

-- Đặt trước: chỉ đặt khi đầu sách không còn bản sẵn sàng; han_giu chỉ có khi đã giữ bản sách.
INSERT INTO dat_truoc (nguoi_dung_id, sach_id, ban_sach_id, ngay_dat, han_giu, trang_thai) VALUES
(1,4,NULL,DATE_SUB(NOW(),INTERVAL 2 DAY),NULL,'CHO_XU_LY'),
(2,6,NULL,DATE_SUB(NOW(),INTERVAL 1 DAY),NULL,'CHO_XU_LY'),
(3,8,NULL,DATE_SUB(NOW(),INTERVAL 5 DAY),DATE_SUB(NOW(),INTERVAL 1 DAY),'HET_HAN'),
(4,1,2,DATE_SUB(NOW(),INTERVAL 50 DAY),DATE_SUB(NOW(),INTERVAL 47 DAY),'DA_NHAN'),
(5,10,12,DATE_SUB(NOW(),INTERVAL 3 DAY),DATE_ADD(NOW(),INTERVAL 1 DAY),'SAN_SANG_NHAN'),
(6,11,NULL,DATE_SUB(NOW(),INTERVAL 2 DAY),NULL,'CHO_XU_LY'),
(8,14,NULL,DATE_SUB(NOW(),INTERVAL 8 DAY),NULL,'HUY'),
(9,15,NULL,DATE_SUB(NOW(),INTERVAL 1 DAY),NULL,'CHO_XU_LY'),
(10,4,NULL,DATE_SUB(NOW(),INTERVAL 1 DAY),NULL,'CHO_XU_LY'),
(1,4,19,DATE_SUB(NOW(),INTERVAL 93 DAY),DATE_SUB(NOW(),INTERVAL 90 DAY),'DA_NHAN');

INSERT INTO nhat_ky_hanh_vi (nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta, thoi_gian) VALUES
(1,'TRA_CUU','SACH',1,'Tra cứu Cơ sở dữ liệu',DATE_SUB(NOW(),INTERVAL 12 DAY)),
(1,'MUON','CT_PHIEU_MUON',1,'Mượn bản sách',DATE_SUB(NOW(),INTERVAL 25 DAY)),
(2,'TRA_CUU','SACH',2,'Tra cứu Hệ quản trị CSDL',DATE_SUB(NOW(),INTERVAL 6 DAY)),
(2,'MUON','CT_PHIEU_MUON',2,'Mượn bản sách',DATE_SUB(NOW(),INTERVAL 5 DAY)),
(3,'TRA','CT_PHIEU_MUON',3,'Trả sách',DATE_SUB(NOW(),INTERVAL 25 DAY)),
(4,'MUON','CT_PHIEU_MUON',4,'Mượn bản sách',DATE_SUB(NOW(),INTERVAL 18 DAY)),
(5,'VI_PHAM','CT_PHIEU_MUON',5,'Trả quá hạn và hư hỏng',DATE_SUB(NOW(),INTERVAL 44 DAY)),
(6,'MUON','CT_PHIEU_MUON',6,'Mượn bản sách',DATE_SUB(NOW(),INTERVAL 8 DAY)),
(8,'MUON','CT_PHIEU_MUON',7,'Mượn bản sách',DATE_SUB(NOW(),INTERVAL 3 DAY)),
(9,'TRA','CT_PHIEU_MUON',8,'Trả sách',DATE_SUB(NOW(),INTERVAL 27 DAY)),
(10,'MUON','CT_PHIEU_MUON',9,'Mượn bản sách',DATE_SUB(NOW(),INTERVAL 12 DAY)),
(1,'VI_PHAM','CT_PHIEU_MUON',10,'Làm mất sách',DATE_SUB(NOW(),INTERVAL 70 DAY)),
(9,'GIA_HAN','CT_PHIEU_MUON',8,'Gia hạn mượn sách',DATE_SUB(NOW(),INTERVAL 40 DAY)),
(3,'DAT_TRUOC','DAT_TRUOC',3,'Đặt trước sách',DATE_SUB(NOW(),INTERVAL 5 DAY)),
(4,'TRA_CUU','SACH',14,'Tra cứu Clean Code',DATE_SUB(NOW(),INTERVAL 1 DAY));

-- ===== 03_functions.sql =====
USE qltv_nhom8;

-- 03. FUNCTIONS
DELIMITER $$

-- Đọc tham số nghiệp vụ từ bảng tham_so
DROP FUNCTION IF EXISTS fn_tham_so$$
CREATE FUNCTION fn_tham_so(p_ma VARCHAR(40))
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
    DECLARE v_gia_tri DECIMAL(12,2);

    SELECT gia_tri INTO v_gia_tri
    FROM tham_so
    WHERE ma_tham_so = p_ma;

    IF v_gia_tri IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Thieu tham so nghiep vu';
    END IF;

    RETURN v_gia_tri;
END$$

-- Không DETERMINISTIC vì dùng CURDATE() khi chưa trả; NO SQL vì không đọc bảng nào
DROP FUNCTION IF EXISTS fn_so_ngay_qua_han$$
CREATE FUNCTION fn_so_ngay_qua_han(p_han_tra DATE, p_ngay_tra DATE)
RETURNS INT
NOT DETERMINISTIC
NO SQL
BEGIN
    RETURN GREATEST(DATEDIFF(COALESCE(p_ngay_tra, CURDATE()), p_han_tra), 0);
END$$

-- Tiền phạt quá hạn có trần PHAT_QUA_HAN_TOI_DA mỗi lượt mượn
DROP FUNCTION IF EXISTS fn_tien_phat_qua_han$$
CREATE FUNCTION fn_tien_phat_qua_han(p_han_tra DATE, p_ngay_tra DATE)
RETURNS DECIMAL(12,2)
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    RETURN LEAST(
        fn_so_ngay_qua_han(p_han_tra, p_ngay_tra) * fn_tham_so('PHAT_QUA_HAN_NGAY'),
        fn_tham_so('PHAT_QUA_HAN_TOI_DA')
    );
END$$

-- Tiền đền mất sách: mức cao hơn giữa PHAT_MAT_SACH và giá bìa (nếu đã biết)
DROP FUNCTION IF EXISTS fn_tien_phat_mat_sach$$
CREATE FUNCTION fn_tien_phat_mat_sach(p_ban_sach_id BIGINT)
RETURNS DECIMAL(12,2)
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_gia DECIMAL(12,2);

    SELECT s.gia_bia INTO v_gia
    FROM ban_sach b
    JOIN sach s ON s.id = b.sach_id
    WHERE b.id = p_ban_sach_id;

    RETURN GREATEST(fn_tham_so('PHAT_MAT_SACH'), COALESCE(v_gia, 0));
END$$

-- Lý do KHÔNG được đặt trước hoặc mượn (người dùng không hoạt động, giữ sách quá hạn, còn nợ phạt),
-- hoặc NULL nếu không bị chặn. FOR SHARE đọc bản mới nhất thay vì snapshot REPEATABLE READ.
DROP FUNCTION IF EXISTS fn_ly_do_khong_the_dat_truoc$$
CREATE FUNCTION fn_ly_do_khong_the_dat_truoc(p_nguoi_dung_id BIGINT)
RETURNS VARCHAR(100)
READS SQL DATA
BEGIN
    DECLARE v_trang_thai VARCHAR(20);
    DECLARE v_qua_han INT DEFAULT 0;
    DECLARE v_no_phat DECIMAL(12,2) DEFAULT 0;

    SELECT trang_thai INTO v_trang_thai
    FROM nguoi_dung
    WHERE id = p_nguoi_dung_id;

    IF v_trang_thai IS NULL THEN
        RETURN 'Nguoi dung khong ton tai';
    END IF;

    IF v_trang_thai <> 'HOAT_DONG' THEN
        RETURN 'Nguoi dung khong hoat dong';
    END IF;

    SELECT COUNT(*) INTO v_qua_han
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE p.nguoi_dung_id = p_nguoi_dung_id
      AND c.ngay_tra IS NULL
      AND c.han_tra < CURDATE()
    FOR SHARE;

    IF v_qua_han > 0 THEN
        RETURN 'Dang giu sach qua han chua tra';
    END IF;

    SELECT COALESCE(SUM(pp.so_tien), 0) INTO v_no_phat
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE p.nguoi_dung_id = p_nguoi_dung_id
      AND pp.trang_thai = 'CHUA_THANH_TOAN';

    IF v_no_phat > 0 THEN
        RETURN 'Con no tien phat chua thanh toan';
    END IF;

    RETURN NULL;
END$$

-- Trả về lý do KHÔNG được mượn, hoặc NULL nếu được mượn (= điều kiện đặt trước + chưa mượn đủ số tối đa)
DROP FUNCTION IF EXISTS fn_ly_do_khong_the_muon$$
CREATE FUNCTION fn_ly_do_khong_the_muon(p_nguoi_dung_id BIGINT)
RETURNS VARCHAR(100)
READS SQL DATA
BEGIN
    DECLARE v_ly_do VARCHAR(100);
    DECLARE v_dang_muon INT DEFAULT 0;

    SET v_ly_do = fn_ly_do_khong_the_dat_truoc(p_nguoi_dung_id);
    IF v_ly_do IS NOT NULL THEN
        RETURN v_ly_do;
    END IF;

    -- FOR SHARE: đọc bản mới nhất đã commit thay vì snapshot REPEATABLE READ của phiên hiện tại.
    -- Nếu không, hai phiên cùng mượn cho một người (khác bản sách) có thể cùng thấy số lượt mượn cũ
    -- và cùng vượt SO_SACH_TOI_DA dù trigger đã khóa hàng nguoi_dung.
    SELECT COUNT(*) INTO v_dang_muon
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE p.nguoi_dung_id = p_nguoi_dung_id
      AND c.ngay_tra IS NULL
    FOR SHARE;

    IF v_dang_muon >= fn_tham_so('SO_SACH_TOI_DA') THEN
        RETURN 'Da muon toi da so sach cho phep';
    END IF;

    RETURN NULL;
END$$

DROP FUNCTION IF EXISTS fn_co_the_muon$$
CREATE FUNCTION fn_co_the_muon(p_nguoi_dung_id BIGINT)
RETURNS TINYINT
READS SQL DATA
BEGIN
    RETURN IF(fn_ly_do_khong_the_muon(p_nguoi_dung_id) IS NULL, 1, 0);
END$$

DELIMITER ;

-- ===== 04_procedures.sql =====
USE qltv_nhom8;

-- 04. PROCEDURES
-- Các procedure không tự mở transaction: ứng dụng có thể bọc START TRANSACTION/COMMIT bên ngoài.
-- Chống mượn trùng/đặt trước trùng khi chạy đồng thời dựa vào UNIQUE (cột sinh tự động) + khóa hàng trong trigger.
DELIMITER $$

-- Nội bộ: bản sách vừa được giải phóng -> giao cho người đặt trước sớm nhất, nếu không có thì SAN_SANG.
DROP PROCEDURE IF EXISTS sp_cap_phat_ban_sach$$
CREATE PROCEDURE sp_cap_phat_ban_sach(IN p_ban_sach_id BIGINT)
BEGIN
    DECLARE v_sach_id BIGINT;
    DECLARE v_dt_id BIGINT;
    DECLARE v_nguoi_dung_id BIGINT;

    SELECT sach_id INTO v_sach_id
    FROM ban_sach
    WHERE id = p_ban_sach_id;

    SELECT d.id, d.nguoi_dung_id INTO v_dt_id, v_nguoi_dung_id
    FROM dat_truoc d
    JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
    WHERE d.sach_id = v_sach_id
      AND d.trang_thai = 'CHO_XU_LY'
      AND nd.trang_thai = 'HOAT_DONG'
    ORDER BY d.ngay_dat, d.id
    LIMIT 1
    FOR UPDATE;

    IF v_dt_id IS NULL THEN
        UPDATE ban_sach SET tinh_trang = 'SAN_SANG' WHERE id = p_ban_sach_id;
    ELSE
        UPDATE ban_sach SET tinh_trang = 'DANG_GIU' WHERE id = p_ban_sach_id;

        UPDATE dat_truoc
        SET trang_thai = 'SAN_SANG_NHAN',
            ban_sach_id = p_ban_sach_id,
            han_giu = DATE_ADD(NOW(), INTERVAL fn_tham_so('SO_NGAY_GIU_DAT_TRUOC') DAY)
        WHERE id = v_dt_id;

        INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
        VALUES(v_nguoi_dung_id, 'GIU_SACH', 'DAT_TRUOC', v_dt_id, 'Giu ban sach cho nguoi dat truoc');
    END IF;
END$$

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
    DECLARE v_ly_do VARCHAR(100);

    SELECT id INTO v_nguoi_dung_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nguoi_dung;

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay nguoi dung';
    END IF;

    SELECT id INTO v_nhan_vien_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nhan_vien
      AND loai_nguoi_dung = 'CAN_BO'
      AND trang_thai = 'HOAT_DONG';

    IF v_nhan_vien_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay can bo thu vien hop le';
    END IF;

    SET v_ly_do = fn_ly_do_khong_the_muon(v_nguoi_dung_id);
    IF v_ly_do IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_ly_do;
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
    DECLARE v_ngay_muon DATE;
    DECLARE v_ban_sach_id BIGINT;

    SELECT id, ngay_muon INTO v_phieu_id, v_ngay_muon
    FROM phieu_muon
    WHERE ma_phieu = p_ma_phieu
      AND trang_thai = 'DANG_MUON';

    IF v_phieu_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu muon khong ton tai hoac da dong';
    END IF;

    SELECT id INTO v_ban_sach_id
    FROM ban_sach
    WHERE ma_ban_sach = p_ma_ban_sach;

    IF v_ban_sach_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay ban sach';
    END IF;

    INSERT INTO ct_phieu_muon(phieu_muon_id, ban_sach_id, han_tra)
    VALUES(v_phieu_id, v_ban_sach_id, DATE_ADD(v_ngay_muon, INTERVAL fn_tham_so('SO_NGAY_MUON') DAY));
END$$

-- Trả sách theo mã bản sách (mỗi bản sách chỉ có tối đa 1 lượt mượn đang mở)
DROP PROCEDURE IF EXISTS sp_tra_sach$$
CREATE PROCEDURE sp_tra_sach(
    IN p_ma_ban_sach VARCHAR(30),
    IN p_tinh_trang_tra VARCHAR(20)
)
BEGIN
    DECLARE v_ct_id BIGINT;

    IF p_tinh_trang_tra IS NULL OR p_tinh_trang_tra NOT IN ('BINH_THUONG','HU_HONG','MAT') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tinh trang tra phai la BINH_THUONG, HU_HONG hoac MAT';
    END IF;

    SELECT c.id INTO v_ct_id
    FROM ct_phieu_muon c
    JOIN ban_sach b ON b.id = c.ban_sach_id
    WHERE b.ma_ban_sach = p_ma_ban_sach
      AND c.ngay_tra IS NULL;

    IF v_ct_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach khong co luot muon dang mo';
    END IF;

    UPDATE ct_phieu_muon
    SET ngay_tra = CURDATE(),
        tinh_trang_tra = p_tinh_trang_tra
    WHERE id = v_ct_id;
END$$

DROP PROCEDURE IF EXISTS sp_gia_han$$
CREATE PROCEDURE sp_gia_han(
    IN p_ma_ban_sach VARCHAR(30),
    IN p_so_ngay INT
)
BEGIN
    DECLARE v_ct_id BIGINT;
    DECLARE v_han_tra DATE;
    DECLARE v_gia_han TINYINT;
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_sach_id BIGINT;
    DECLARE v_trang_thai_nd VARCHAR(20);

    IF p_so_ngay IS NULL OR p_so_ngay < 1 OR p_so_ngay > fn_tham_so('SO_NGAY_GIA_HAN_TOI_DA') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'So ngay gia han khong hop le';
    END IF;

    SELECT c.id, c.han_tra, c.so_lan_gia_han, p.nguoi_dung_id, b.sach_id
    INTO v_ct_id, v_han_tra, v_gia_han, v_nguoi_dung_id, v_sach_id
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    JOIN ban_sach b ON b.id = c.ban_sach_id
    WHERE b.ma_ban_sach = p_ma_ban_sach
      AND c.ngay_tra IS NULL;

    IF v_ct_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach khong co luot muon dang mo';
    END IF;

    IF v_gia_han >= fn_tham_so('SO_LAN_GIA_HAN_TOI_DA') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Luot muon da gia han toi da so lan cho phep';
    END IF;

    IF v_han_tra < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sach da qua han, khong the gia han';
    END IF;

    SELECT trang_thai INTO v_trang_thai_nd
    FROM nguoi_dung
    WHERE id = v_nguoi_dung_id;

    IF v_trang_thai_nd <> 'HOAT_DONG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong hoat dong';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM dat_truoc
        WHERE sach_id = v_sach_id
          AND trang_thai = 'CHO_XU_LY'
          AND nguoi_dung_id <> v_nguoi_dung_id
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sach dang co nguoi dat truoc, khong the gia han';
    END IF;

    UPDATE ct_phieu_muon
    SET han_tra = DATE_ADD(han_tra, INTERVAL p_so_ngay DAY),
        so_lan_gia_han = so_lan_gia_han + 1
    WHERE id = v_ct_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'GIA_HAN', 'CT_PHIEU_MUON', v_ct_id, 'Gia han muon sach');
END$$

-- Chỉ được đặt trước khi đầu sách không còn bản SAN_SANG
DROP PROCEDURE IF EXISTS sp_dat_truoc$$
CREATE PROCEDURE sp_dat_truoc(
    IN p_ma_nguoi_dung VARCHAR(20),
    IN p_ma_sach VARCHAR(20)
)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_sach_id BIGINT;
    DECLARE v_dt_id BIGINT;

    SELECT id INTO v_nguoi_dung_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nguoi_dung;

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay nguoi dung';
    END IF;

    SELECT id INTO v_sach_id
    FROM sach
    WHERE ma_sach = p_ma_sach;

    IF v_sach_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay sach';
    END IF;

    IF EXISTS (SELECT 1 FROM ban_sach WHERE sach_id = v_sach_id AND tinh_trang = 'SAN_SANG') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sach con ban san sang, khong can dat truoc';
    END IF;

    INSERT INTO dat_truoc(nguoi_dung_id, sach_id, han_giu, trang_thai)
    VALUES(v_nguoi_dung_id, v_sach_id, NULL, 'CHO_XU_LY');

    SET v_dt_id = LAST_INSERT_ID();

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'DAT_TRUOC', 'DAT_TRUOC', v_dt_id, 'Dat truoc sach');
END$$

DROP PROCEDURE IF EXISTS sp_huy_dat_truoc$$
CREATE PROCEDURE sp_huy_dat_truoc(
    IN p_ma_nguoi_dung VARCHAR(20),
    IN p_ma_sach VARCHAR(20)
)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_dt_id BIGINT;
    DECLARE v_trang_thai VARCHAR(20);
    DECLARE v_ban_sach_id BIGINT;

    SELECT d.id, d.trang_thai, d.ban_sach_id, d.nguoi_dung_id
    INTO v_dt_id, v_trang_thai, v_ban_sach_id, v_nguoi_dung_id
    FROM dat_truoc d
    JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
    JOIN sach s ON s.id = d.sach_id
    WHERE nd.ma_nguoi_dung = p_ma_nguoi_dung
      AND s.ma_sach = p_ma_sach
      AND d.trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN')
    FOR UPDATE;

    IF v_dt_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong co luot dat truoc dang hoat dong';
    END IF;

    UPDATE dat_truoc SET trang_thai = 'HUY' WHERE id = v_dt_id;

    IF v_trang_thai = 'SAN_SANG_NHAN' THEN
        CALL sp_cap_phat_ban_sach(v_ban_sach_id);
    END IF;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'HUY_DAT_TRUOC', 'DAT_TRUOC', v_dt_id, 'Huy dat truoc');
END$$

DROP PROCEDURE IF EXISTS sp_thanh_toan_phat$$
CREATE PROCEDURE sp_thanh_toan_phat(IN p_phieu_phat_id BIGINT)
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    SELECT p.nguoi_dung_id INTO v_nguoi_dung_id
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE pp.id = p_phieu_phat_id
      AND pp.trang_thai = 'CHUA_THANH_TOAN'
    FOR UPDATE OF pp;  -- khóa dòng phạt: hai phiên thanh toán cùng lúc thì phiên sau báo lỗi thay vì ghi trùng

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu phat khong ton tai hoac khong o trang thai chua thanh toan';
    END IF;

    UPDATE phieu_phat
    SET trang_thai = 'DA_THANH_TOAN'
    WHERE id = p_phieu_phat_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'THANH_TOAN_PHAT', 'PHIEU_PHAT', p_phieu_phat_id, 'Thanh toan phieu phat');
END$$

-- Đổi tình trạng bản sách (sửa xong, thanh lý, tìm lại...). Không áp dụng cho bản đang mượn/đang giữ.
DROP PROCEDURE IF EXISTS sp_cap_nhat_tinh_trang_ban_sach$$
CREATE PROCEDURE sp_cap_nhat_tinh_trang_ban_sach(
    IN p_ma_ban_sach VARCHAR(30),
    IN p_tinh_trang VARCHAR(20)
)
BEGIN
    DECLARE v_id BIGINT;
    DECLARE v_hien_tai VARCHAR(20);

    IF p_tinh_trang IS NULL OR p_tinh_trang NOT IN ('SAN_SANG','HU_HONG','MAT','NGUNG_PHUC_VU') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tinh trang dich khong hop le';
    END IF;

    SELECT id, tinh_trang INTO v_id, v_hien_tai
    FROM ban_sach
    WHERE ma_ban_sach = p_ma_ban_sach
    FOR UPDATE;

    IF v_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong tim thay ban sach';
    END IF;

    IF v_hien_tai IN ('DANG_MUON','DANG_GIU') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach dang muon hoac dang giu, khong doi tinh trang duoc';
    END IF;

    IF p_tinh_trang = 'SAN_SANG' THEN
        CALL sp_cap_phat_ban_sach(v_id);
    ELSE
        UPDATE ban_sach SET tinh_trang = p_tinh_trang WHERE id = v_id;
    END IF;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(NULL, 'DOI_TINH_TRANG', 'BAN_SACH', v_id, CONCAT(v_hien_tai, ' -> ', p_tinh_trang));
END$$

-- Tra cứu theo mã sách, ISBN, tên, tác giả hoặc từ khóa trong tên/mô tả (FULLTEXT)
-- p_ma_nguoi_dung: mã người tra cứu để ghi nhật ký TRA_CUU (NULL nếu ẩn danh hoặc không rõ)
DROP PROCEDURE IF EXISTS sp_tra_cuu_sach$$
CREATE PROCEDURE sp_tra_cuu_sach(IN p_tu_khoa VARCHAR(255), IN p_ma_nguoi_dung VARCHAR(20))
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    SELECT id INTO v_nguoi_dung_id
    FROM nguoi_dung
    WHERE ma_nguoi_dung = p_ma_nguoi_dung;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'TRA_CUU', NULL, NULL, CONCAT('Tra cuu: ', LEFT(COALESCE(p_tu_khoa, ''), 200)));

    SELECT v.*
    FROM vw_tra_cuu_sach v
    WHERE v.ma_sach = p_tu_khoa
       OR v.isbn = p_tu_khoa
       OR v.ten_sach LIKE CONCAT('%', p_tu_khoa, '%')
       OR v.ds_tac_gia LIKE CONCAT('%', p_tu_khoa, '%')
       OR v.ma_sach IN (
            SELECT s.ma_sach
            FROM sach s
            WHERE MATCH(s.ten_sach, s.mo_ta) AGAINST (p_tu_khoa IN NATURAL LANGUAGE MODE)
       )
    ORDER BY v.ten_sach;
END$$

-- Dành cho vai trò bạn đọc: ứng dụng phải truyền đúng mã của người đã đăng nhập (xem docs/04)
DROP PROCEDURE IF EXISTS sp_bandoc_sach_dang_muon$$
CREATE PROCEDURE sp_bandoc_sach_dang_muon(IN p_ma_nguoi_dung VARCHAR(20))
BEGIN
    SELECT ma_phieu, ma_ban_sach, ma_sach, ten_sach, ngay_muon, han_tra, so_ngay_qua_han
    FROM vw_sach_dang_muon
    WHERE ma_nguoi_dung = p_ma_nguoi_dung
    ORDER BY han_tra;
END$$

DROP PROCEDURE IF EXISTS sp_bandoc_tien_phat$$
CREATE PROCEDURE sp_bandoc_tien_phat(IN p_ma_nguoi_dung VARCHAR(20))
BEGIN
    SELECT pp.id AS ma_phieu_phat, pp.loai_phat, pp.so_tien, pp.ly_do, pp.trang_thai, pp.ngay_tao, pp.ngay_thanh_toan
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
    WHERE nd.ma_nguoi_dung = p_ma_nguoi_dung
    ORDER BY pp.ngay_tao DESC, pp.id DESC;
END$$

-- Hủy phiếu mượn còn rỗng (chưa ghi bản sách nào). Phiếu đã có sách thì phải trả sách, không hủy được.
DROP PROCEDURE IF EXISTS sp_huy_phieu_muon$$
CREATE PROCEDURE sp_huy_phieu_muon(IN p_ma_phieu VARCHAR(20))
BEGIN
    DECLARE v_phieu_id BIGINT;
    DECLARE v_nguoi_dung_id BIGINT;

    SELECT id, nguoi_dung_id INTO v_phieu_id, v_nguoi_dung_id
    FROM phieu_muon
    WHERE ma_phieu = p_ma_phieu
      AND trang_thai = 'DANG_MUON'
    FOR UPDATE;

    IF v_phieu_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu muon khong ton tai hoac da dong';
    END IF;

    IF EXISTS (SELECT 1 FROM ct_phieu_muon WHERE phieu_muon_id = v_phieu_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu da co sach, khong huy duoc (hay tra sach)';
    END IF;

    UPDATE phieu_muon SET trang_thai = 'HUY' WHERE id = v_phieu_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'HUY_PHIEU_MUON', 'PHIEU_MUON', v_phieu_id, 'Huy phieu muon rong');
END$$

-- Hủy phiếu phạt lập sai (chỉ khi chưa thanh toán). Thao tác nhạy cảm nên chỉ dành cho quản trị.
DROP PROCEDURE IF EXISTS sp_huy_phat$$
CREATE PROCEDURE sp_huy_phat(IN p_phieu_phat_id BIGINT, IN p_ly_do VARCHAR(200))
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    IF p_ly_do IS NULL OR CHAR_LENGTH(TRIM(p_ly_do)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phai nhap ly do huy phieu phat';
    END IF;

    SELECT p.nguoi_dung_id INTO v_nguoi_dung_id
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE pp.id = p_phieu_phat_id
      AND pp.trang_thai = 'CHUA_THANH_TOAN'
    FOR UPDATE OF pp;

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu phat khong ton tai hoac khong o trang thai chua thanh toan';
    END IF;

    UPDATE phieu_phat
    SET trang_thai = 'HUY',
        ly_do = LEFT(CONCAT(COALESCE(ly_do, ''), ' | Huy: ', TRIM(p_ly_do)), 255)
    WHERE id = p_phieu_phat_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'HUY_PHAT', 'PHIEU_PHAT', p_phieu_phat_id, 'Huy phieu phat');
END$$

DELIMITER ;

-- ===== 05_triggers.sql =====
USE qltv_nhom8;

-- 05. TRIGGERS
DELIMITER $$

-- Bản sách mới nhập: không được nhập thẳng ở trạng thái đang mượn/đang giữ. Nếu đầu sách đang có người
-- chờ (CHO_XU_LY) thì bản mới chuyển DANG_GIU ngay (trg_ban_sach_ai giao cho người đặt sớm nhất), tránh
-- để người ngoài hàng đợi mượn mất. Không thể CALL sp_cap_phat_ban_sach ở đây vì thủ tục đó UPDATE
-- chính bảng ban_sach (MySQL cấm sửa bảng đang được câu lệnh gọi trigger sử dụng).
DROP TRIGGER IF EXISTS trg_ban_sach_bi$$
CREATE TRIGGER trg_ban_sach_bi
BEFORE INSERT ON ban_sach
FOR EACH ROW
BEGIN
    DECLARE v_dt_id BIGINT;

    IF NEW.tinh_trang IN ('DANG_MUON','DANG_GIU') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach moi khong duoc nhap o trang thai dang muon hoac dang giu';
    END IF;

    IF NEW.tinh_trang = 'SAN_SANG' THEN
        SELECT d.id INTO v_dt_id
        FROM dat_truoc d
        JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
        WHERE d.sach_id = NEW.sach_id
          AND d.trang_thai = 'CHO_XU_LY'
          AND nd.trang_thai = 'HOAT_DONG'
        ORDER BY d.ngay_dat, d.id
        LIMIT 1
        FOR UPDATE;

        IF v_dt_id IS NOT NULL THEN
            SET NEW.tinh_trang = 'DANG_GIU';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ban_sach_ai$$
CREATE TRIGGER trg_ban_sach_ai
AFTER INSERT ON ban_sach
FOR EACH ROW
BEGIN
    DECLARE v_dt_id BIGINT;
    DECLARE v_nguoi_dung_id BIGINT;

    IF NEW.tinh_trang = 'DANG_GIU' THEN
        SELECT d.id, d.nguoi_dung_id INTO v_dt_id, v_nguoi_dung_id
        FROM dat_truoc d
        JOIN nguoi_dung nd ON nd.id = d.nguoi_dung_id
        WHERE d.sach_id = NEW.sach_id
          AND d.trang_thai = 'CHO_XU_LY'
          AND nd.trang_thai = 'HOAT_DONG'
        ORDER BY d.ngay_dat, d.id
        LIMIT 1
        FOR UPDATE;

        IF v_dt_id IS NOT NULL THEN
            UPDATE dat_truoc
            SET trang_thai = 'SAN_SANG_NHAN',
                ban_sach_id = NEW.id,
                han_giu = DATE_ADD(NOW(), INTERVAL fn_tham_so('SO_NGAY_GIU_DAT_TRUOC') DAY)
            WHERE id = v_dt_id;

            INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
            VALUES(v_nguoi_dung_id, 'GIU_SACH', 'DAT_TRUOC', v_dt_id, 'Giu ban sach moi nhap cho nguoi dat truoc');
        END IF;
    END IF;
END$$

-- Người lập phiếu phải là cán bộ thư viện
DROP TRIGGER IF EXISTS trg_phieu_muon_bi$$
CREATE TRIGGER trg_phieu_muon_bi
BEFORE INSERT ON phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_loai VARCHAR(20);

    SELECT loai_nguoi_dung INTO v_loai
    FROM nguoi_dung
    WHERE id = NEW.nhan_vien_id;

    IF v_loai IS NULL OR v_loai <> 'CAN_BO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nhan vien lap phieu phai la can bo thu vien';
    END IF;
END$$

-- Kiểm tra điều kiện mượn. Khóa hàng bản sách và người dùng (FOR UPDATE) để hai lượt mượn
-- đồng thời không cùng vượt qua kiểm tra.
DROP TRIGGER IF EXISTS trg_ctpm_bi$$
CREATE TRIGGER trg_ctpm_bi
BEFORE INSERT ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_tinh_trang VARCHAR(20);
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_ngay_muon DATE;
    DECLARE v_khoa BIGINT;
    DECLARE v_dt_id BIGINT;
    DECLARE v_ly_do VARCHAR(100);

    SELECT tinh_trang INTO v_tinh_trang
    FROM ban_sach
    WHERE id = NEW.ban_sach_id
    FOR UPDATE;

    SELECT nguoi_dung_id, ngay_muon INTO v_nguoi_dung_id, v_ngay_muon
    FROM phieu_muon
    WHERE id = NEW.phieu_muon_id
      AND trang_thai = 'DANG_MUON';

    IF v_nguoi_dung_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu muon khong ton tai hoac da dong';
    END IF;

    SELECT id INTO v_khoa
    FROM nguoi_dung
    WHERE id = v_nguoi_dung_id
    FOR UPDATE;

    IF v_tinh_trang IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach khong ton tai';
    END IF;

    IF v_tinh_trang = 'DANG_GIU' THEN
        -- chỉ chính người đặt trước, còn hạn giữ, mới được mượn bản đang giữ
        SELECT id INTO v_dt_id
        FROM dat_truoc
        WHERE ban_sach_id = NEW.ban_sach_id
          AND trang_thai = 'SAN_SANG_NHAN'
          AND nguoi_dung_id = v_nguoi_dung_id
          AND han_giu >= NOW()
        LIMIT 1
        FOR UPDATE;

        IF v_dt_id IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach dang duoc giu cho nguoi khac';
        END IF;
    ELSEIF v_tinh_trang <> 'SAN_SANG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ban sach khong san sang';
    END IF;

    SET v_ly_do = fn_ly_do_khong_the_muon(v_nguoi_dung_id);
    IF v_ly_do IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_ly_do;
    END IF;

    IF NEW.han_tra < v_ngay_muon THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Han tra khong duoc truoc ngay muon';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ctpm_ai$$
CREATE TRIGGER trg_ctpm_ai
AFTER INSERT ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    SELECT nguoi_dung_id INTO v_nguoi_dung_id
    FROM phieu_muon
    WHERE id = NEW.phieu_muon_id;

    UPDATE ban_sach
    SET tinh_trang = 'DANG_MUON'
    WHERE id = NEW.ban_sach_id;

    -- mượn đúng bản đang giữ -> lượt đặt trước hoàn tất
    UPDATE dat_truoc
    SET trang_thai = 'DA_NHAN'
    WHERE ban_sach_id = NEW.ban_sach_id
      AND trang_thai = 'SAN_SANG_NHAN'
      AND nguoi_dung_id = v_nguoi_dung_id;

    INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
    VALUES(v_nguoi_dung_id, 'MUON', 'CT_PHIEU_MUON', NEW.id, 'Muon ban sach');
END$$

-- Bảo vệ dữ liệu khi UPDATE trực tiếp: không sửa lượt mượn đã trả; đổi hạn phải là gia hạn hợp lệ.
DROP TRIGGER IF EXISTS trg_ctpm_bu$$
CREATE TRIGGER trg_ctpm_bu
BEFORE UPDATE ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_trang_thai_nd VARCHAR(20);
    DECLARE v_sach_id BIGINT;

    IF NEW.phieu_muon_id <> OLD.phieu_muon_id OR NEW.ban_sach_id <> OLD.ban_sach_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong duoc doi phieu muon hoac ban sach cua chi tiet muon';
    END IF;

    IF OLD.ngay_tra IS NOT NULL
       AND (NOT (NEW.ngay_tra <=> OLD.ngay_tra)
            OR NOT (NEW.tinh_trang_tra <=> OLD.tinh_trang_tra)
            OR NEW.han_tra <> OLD.han_tra
            OR NEW.so_lan_gia_han <> OLD.so_lan_gia_han) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chi tiet muon da tra, khong duoc sua';
    END IF;

    IF OLD.ngay_tra IS NULL AND NEW.ngay_tra IS NOT NULL AND NEW.tinh_trang_tra IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phai co tinh trang tra khi tra sach';
    END IF;

    IF NEW.han_tra <> OLD.han_tra THEN
        IF NEW.so_lan_gia_han <> OLD.so_lan_gia_han + 1 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Doi han tra phai di kem gia han 1 lan';
        END IF;

        IF DATEDIFF(NEW.han_tra, OLD.han_tra) < 1
           OR DATEDIFF(NEW.han_tra, OLD.han_tra) > fn_tham_so('SO_NGAY_GIA_HAN_TOI_DA') THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'So ngay gia han vuot quy dinh';
        END IF;

        IF NEW.so_lan_gia_han > fn_tham_so('SO_LAN_GIA_HAN_TOI_DA') THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Luot muon da gia han toi da so lan cho phep';
        END IF;

        IF OLD.han_tra < CURDATE() THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sach da qua han, khong the gia han';
        END IF;

        SELECT p.nguoi_dung_id, nd.trang_thai INTO v_nguoi_dung_id, v_trang_thai_nd
        FROM phieu_muon p
        JOIN nguoi_dung nd ON nd.id = p.nguoi_dung_id
        WHERE p.id = NEW.phieu_muon_id;

        IF v_trang_thai_nd IS NULL OR v_trang_thai_nd <> 'HOAT_DONG' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong hoat dong';
        END IF;

        SELECT sach_id INTO v_sach_id
        FROM ban_sach
        WHERE id = NEW.ban_sach_id;

        IF EXISTS (
            SELECT 1
            FROM dat_truoc
            WHERE sach_id = v_sach_id
              AND trang_thai = 'CHO_XU_LY'
              AND nguoi_dung_id <> v_nguoi_dung_id
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sach dang co nguoi dat truoc, khong the gia han';
        END IF;
    ELSEIF NEW.so_lan_gia_han <> OLD.so_lan_gia_han THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong duoc doi so lan gia han khi khong doi han tra';
    END IF;
END$$

-- Khi trả sách: cập nhật bản sách, sinh phiếu phạt, đóng phiếu mượn nếu đã trả hết, giao bản cho người đặt trước.
DROP TRIGGER IF EXISTS trg_ctpm_au$$
CREATE TRIGGER trg_ctpm_au
AFTER UPDATE ON ct_phieu_muon
FOR EACH ROW
BEGIN
    DECLARE v_nguoi_dung_id BIGINT;

    IF OLD.ngay_tra IS NULL AND NEW.ngay_tra IS NOT NULL THEN
        SELECT nguoi_dung_id INTO v_nguoi_dung_id
        FROM phieu_muon
        WHERE id = NEW.phieu_muon_id;

        IF NEW.tinh_trang_tra = 'HU_HONG' THEN
            UPDATE ban_sach SET tinh_trang = 'HU_HONG' WHERE id = NEW.ban_sach_id;
        ELSEIF NEW.tinh_trang_tra = 'MAT' THEN
            UPDATE ban_sach SET tinh_trang = 'MAT' WHERE id = NEW.ban_sach_id;
        ELSE
            CALL sp_cap_phat_ban_sach(NEW.ban_sach_id);
        END IF;

        IF fn_so_ngay_qua_han(NEW.han_tra, NEW.ngay_tra) > 0 THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'QUA_HAN', fn_tien_phat_qua_han(NEW.han_tra, NEW.ngay_tra), 'Tra sach qua han');
        END IF;

        IF NEW.tinh_trang_tra = 'HU_HONG' THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'HU_HONG', fn_tham_so('PHAT_HU_HONG'), 'Sach hu hong khi tra');
        END IF;

        IF NEW.tinh_trang_tra = 'MAT' THEN
            INSERT INTO phieu_phat(ct_phieu_muon_id, loai_phat, so_tien, ly_do)
            VALUES(NEW.id, 'MAT_SACH', fn_tien_phat_mat_sach(NEW.ban_sach_id), 'Mat sach');
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM ct_phieu_muon
            WHERE phieu_muon_id = NEW.phieu_muon_id
              AND ngay_tra IS NULL
        ) THEN
            UPDATE phieu_muon
            SET trang_thai = 'HOAN_TAT'
            WHERE id = NEW.phieu_muon_id;
        END IF;

        INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
        VALUES(v_nguoi_dung_id, 'TRA', 'CT_PHIEU_MUON', NEW.id, 'Tra sach');
    END IF;
END$$

-- Chỉ kiểm tra khi tạo lượt đặt đang hoạt động (chèn dữ liệu lịch sử DA_NHAN/HUY/HET_HAN thì bỏ qua).
-- Người đang bị chặn mượn (không hoạt động, giữ sách quá hạn, nợ phạt) cũng không được đặt trước,
-- tránh việc được giữ sách rồi không mượn nổi.
DROP TRIGGER IF EXISTS trg_dat_truoc_bi$$
CREATE TRIGGER trg_dat_truoc_bi
BEFORE INSERT ON dat_truoc
FOR EACH ROW
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_ly_do VARCHAR(100);

    IF NEW.trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN') THEN
        SET v_ly_do = fn_ly_do_khong_the_dat_truoc(NEW.nguoi_dung_id);
        IF v_ly_do IS NOT NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_ly_do;
        END IF;

        SELECT COUNT(*) INTO v_count
        FROM dat_truoc
        WHERE nguoi_dung_id = NEW.nguoi_dung_id
          AND sach_id = NEW.sach_id
          AND trang_thai IN ('CHO_XU_LY','SAN_SANG_NHAN');

        IF v_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Da co dat truoc dang hoat dong';
        END IF;
    END IF;
END$$

-- Phiếu phạt đã thanh toán/đã hủy là bất biến; khi thanh toán tự điền ngày.
DROP TRIGGER IF EXISTS trg_phieu_phat_bu$$
CREATE TRIGGER trg_phieu_phat_bu
BEFORE UPDATE ON phieu_phat
FOR EACH ROW
BEGIN
    IF OLD.trang_thai IN ('DA_THANH_TOAN','HUY')
       AND (NEW.trang_thai <> OLD.trang_thai OR NEW.so_tien <> OLD.so_tien) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phieu phat da thanh toan hoac da huy, khong duoc sua';
    END IF;

    IF OLD.trang_thai <> 'DA_THANH_TOAN' AND NEW.trang_thai = 'DA_THANH_TOAN' THEN
        SET NEW.ngay_thanh_toan = COALESCE(NEW.ngay_thanh_toan, CURDATE());
    END IF;
END$$

-- Tài khoản phải khớp loại người dùng (BAN_DOC cho SV/GV; ADMIN, THU_THU cho CAN_BO)
-- và không được HOAT_DONG khi người dùng đang bị tạm khóa/ngừng.
DROP TRIGGER IF EXISTS trg_tai_khoan_bi$$
CREATE TRIGGER trg_tai_khoan_bi
BEFORE INSERT ON tai_khoan
FOR EACH ROW
BEGIN
    DECLARE v_loai VARCHAR(20);
    DECLARE v_trang_thai VARCHAR(20);

    SELECT loai_nguoi_dung, trang_thai INTO v_loai, v_trang_thai
    FROM nguoi_dung
    WHERE id = NEW.nguoi_dung_id;

    IF (NEW.vai_tro = 'BAN_DOC' AND v_loai = 'CAN_BO')
       OR (NEW.vai_tro IN ('ADMIN','THU_THU') AND v_loai <> 'CAN_BO') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vai tro tai khoan khong phu hop loai nguoi dung';
    END IF;

    IF NEW.trang_thai = 'HOAT_DONG' AND v_trang_thai <> 'HOAT_DONG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong hoat dong, tai khoan phai o trang thai KHOA';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_tai_khoan_bu$$
CREATE TRIGGER trg_tai_khoan_bu
BEFORE UPDATE ON tai_khoan
FOR EACH ROW
BEGIN
    DECLARE v_loai VARCHAR(20);
    DECLARE v_trang_thai VARCHAR(20);

    SELECT loai_nguoi_dung, trang_thai INTO v_loai, v_trang_thai
    FROM nguoi_dung
    WHERE id = NEW.nguoi_dung_id;

    IF (NEW.vai_tro = 'BAN_DOC' AND v_loai = 'CAN_BO')
       OR (NEW.vai_tro IN ('ADMIN','THU_THU') AND v_loai <> 'CAN_BO') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vai tro tai khoan khong phu hop loai nguoi dung';
    END IF;

    IF NEW.trang_thai = 'HOAT_DONG' AND v_trang_thai <> 'HOAT_DONG' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nguoi dung khong hoat dong, tai khoan phai o trang thai KHOA';
    END IF;
END$$

-- Đổi trạng thái người dùng thì tài khoản đi theo (HOAT_DONG <-> KHOA); không cho đổi loại người dùng
-- làm lệch vai trò tài khoản.
DROP TRIGGER IF EXISTS trg_nguoi_dung_au$$
CREATE TRIGGER trg_nguoi_dung_au
AFTER UPDATE ON nguoi_dung
FOR EACH ROW
BEGIN
    IF NEW.loai_nguoi_dung <> OLD.loai_nguoi_dung AND EXISTS (
        SELECT 1
        FROM tai_khoan
        WHERE nguoi_dung_id = NEW.id
          AND ((vai_tro = 'BAN_DOC' AND NEW.loai_nguoi_dung = 'CAN_BO')
               OR (vai_tro IN ('ADMIN','THU_THU') AND NEW.loai_nguoi_dung <> 'CAN_BO'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Doi loai nguoi dung lam lech vai tro tai khoan';
    END IF;

    IF NOT (NEW.trang_thai <=> OLD.trang_thai) THEN
        UPDATE tai_khoan
        SET trang_thai = IF(NEW.trang_thai = 'HOAT_DONG', 'HOAT_DONG', 'KHOA')
        WHERE nguoi_dung_id = NEW.id;
    END IF;
END$$

DELIMITER ;

-- ===== 06_cursors.sql =====
USE qltv_nhom8;

-- 06. CURSORS
DELIMITER $$

-- Ghi nhật ký VI_PHAM (mỗi lượt mượn quá hạn tối đa 1 lần/ngày). Tiền phạt tạm tính xem ở vw_muon_qua_han;
-- phiếu phạt chính thức được lập khi trả sách. Người đang quá hạn bị chặn mượn thêm (fn_ly_do_khong_the_muon).
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

-- Thống kê theo người dùng: so_phieu_muon = số phiếu, so_sach_da_muon = số lượt mượn bản sách
-- (cùng đơn vị với vw_top_sach_muon_nhieu).
DROP PROCEDURE IF EXISTS sp_cursor_thong_ke_muon_theo_nguoi_dung$$
CREATE PROCEDURE sp_cursor_thong_ke_muon_theo_nguoi_dung()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_id BIGINT;
    DECLARE v_ma VARCHAR(20);
    DECLARE v_ten VARCHAR(160);
    DECLARE v_so_phieu INT;
    DECLARE v_so_sach INT;

    DECLARE cur CURSOR FOR
        SELECT id, ma_nguoi_dung, ho_ten
        FROM nguoi_dung
        WHERE loai_nguoi_dung IN ('SINH_VIEN','GIANG_VIEN');

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    DROP TEMPORARY TABLE IF EXISTS tmp_thong_ke_muon;
    CREATE TEMPORARY TABLE tmp_thong_ke_muon (
        ma_nguoi_dung VARCHAR(20),
        ho_ten VARCHAR(160),
        so_phieu_muon INT,
        so_sach_da_muon INT
    );

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_id, v_ma, v_ten;

        IF done = 1 THEN
            LEAVE read_loop;
        END IF;

        SELECT COUNT(*) INTO v_so_phieu
        FROM phieu_muon
        WHERE nguoi_dung_id = v_id;

        SELECT COUNT(*) INTO v_so_sach
        FROM ct_phieu_muon c
        JOIN phieu_muon p ON p.id = c.phieu_muon_id
        WHERE p.nguoi_dung_id = v_id;

        INSERT INTO tmp_thong_ke_muon
        VALUES(v_ma, v_ten, v_so_phieu, v_so_sach);
    END LOOP;

    CLOSE cur;

    SELECT *
    FROM tmp_thong_ke_muon
    ORDER BY so_sach_da_muon DESC, so_phieu_muon DESC, ma_nguoi_dung;
END$$

-- Xử lý các lượt giữ sách quá hạn: đánh dấu HET_HAN rồi giao bản sách cho người kế tiếp (hoặc trả về SAN_SANG).
DROP PROCEDURE IF EXISTS sp_cursor_het_han_dat_truoc$$
CREATE PROCEDURE sp_cursor_het_han_dat_truoc()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_dt_id BIGINT;
    DECLARE v_nguoi_dung_id BIGINT;
    DECLARE v_ban_sach_id BIGINT;

    DECLARE cur CURSOR FOR
        SELECT id, nguoi_dung_id, ban_sach_id
        FROM dat_truoc
        WHERE trang_thai = 'SAN_SANG_NHAN'
          AND han_giu < NOW();

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_dt_id, v_nguoi_dung_id, v_ban_sach_id;

        IF done = 1 THEN
            LEAVE read_loop;
        END IF;

        UPDATE dat_truoc SET trang_thai = 'HET_HAN' WHERE id = v_dt_id;

        CALL sp_cap_phat_ban_sach(v_ban_sach_id);

        INSERT INTO nhat_ky_hanh_vi(nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta)
        VALUES(v_nguoi_dung_id, 'HET_HAN_DAT_TRUOC', 'DAT_TRUOC', v_dt_id, 'Het han giu sach');

        -- lệnh bên trong có thể làm bật NOT FOUND; chỉ FETCH mới quyết định kết thúc vòng lặp
        SET done = 0;
    END LOOP;

    CLOSE cur;
END$$

DELIMITER ;

-- Lập lịch tự động (cần event_scheduler = ON, mặc định của MySQL 8.0+; kiểm tra: SHOW VARIABLES LIKE 'event_scheduler').
-- Giữ sách hết hạn được xử lý mỗi giờ để bản sách không bị kẹt ở DANG_GIU; quá hạn mượn ghi nhật ký mỗi ngày.
DROP EVENT IF EXISTS ev_het_han_dat_truoc;
CREATE EVENT ev_het_han_dat_truoc
ON SCHEDULE EVERY 1 HOUR
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY)
DO CALL sp_cursor_het_han_dat_truoc();

DROP EVENT IF EXISTS ev_danh_dau_qua_han;
CREATE EVENT ev_danh_dau_qua_han
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 5 MINUTE)
DO CALL sp_cursor_danh_dau_qua_han();

-- ===== 07_reports.sql =====
USE qltv_nhom8;

-- 07. REPORTS
-- Bản MAT/NGUNG_PHUC_VU không tính vào tổng số bản; sách chưa có bản nào vẫn hiện với số 0.
CREATE OR REPLACE VIEW vw_danh_muc_sach AS
SELECT
    s.ma_sach,
    s.ten_sach,
    tl.ten_the_loai,
    nxb.ten_nxb,
    s.nam_xuat_ban,
    COUNT(bs.id) AS tong_so_ban,
    COALESCE(SUM(bs.tinh_trang = 'SAN_SANG'), 0) AS so_ban_san_sang
FROM sach s
JOIN the_loai tl ON tl.id = s.the_loai_id
JOIN nha_xuat_ban nxb ON nxb.id = s.nxb_id
LEFT JOIN ban_sach bs ON bs.sach_id = s.id
    AND bs.tinh_trang NOT IN ('MAT','NGUNG_PHUC_VU')
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
    c.han_tra,
    fn_so_ngay_qua_han(c.han_tra, c.ngay_tra) AS so_ngay_qua_han
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

-- Gồm cả người đã bị lập phiếu phạt và người đang giữ sách quá hạn (chưa có phiếu phạt).
CREATE OR REPLACE VIEW vw_nguoi_dung_vi_pham AS
SELECT
    nd.ma_nguoi_dung,
    nd.ho_ten,
    COALESCE(f.so_lan_phat, 0) AS so_lan_phat,
    COALESCE(f.tong_tien_phat, 0) AS tong_tien_phat,
    COALESCE(f.con_no, 0) AS con_no,
    COALESCE(q.so_sach_qua_han, 0) AS so_sach_dang_qua_han,
    COALESCE(q.tien_phat_tam_tinh, 0) AS tien_phat_tam_tinh
FROM nguoi_dung nd
LEFT JOIN (
    SELECT
        p.nguoi_dung_id,
        COUNT(pp.id) AS so_lan_phat,
        SUM(pp.so_tien) AS tong_tien_phat,
        SUM(CASE WHEN pp.trang_thai = 'CHUA_THANH_TOAN' THEN pp.so_tien ELSE 0 END) AS con_no
    FROM phieu_phat pp
    JOIN ct_phieu_muon c ON c.id = pp.ct_phieu_muon_id
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE pp.trang_thai <> 'HUY'
    GROUP BY p.nguoi_dung_id
) f ON f.nguoi_dung_id = nd.id
LEFT JOIN (
    SELECT
        p.nguoi_dung_id,
        COUNT(*) AS so_sach_qua_han,
        SUM(fn_tien_phat_qua_han(c.han_tra, c.ngay_tra)) AS tien_phat_tam_tinh
    FROM ct_phieu_muon c
    JOIN phieu_muon p ON p.id = c.phieu_muon_id
    WHERE c.ngay_tra IS NULL
      AND c.han_tra < CURDATE()
    GROUP BY p.nguoi_dung_id
) q ON q.nguoi_dung_id = nd.id
WHERE f.nguoi_dung_id IS NOT NULL
   OR q.nguoi_dung_id IS NOT NULL;

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

-- Tra cứu sách: có tác giả và số bản sẵn sàng
CREATE OR REPLACE VIEW vw_tra_cuu_sach AS
SELECT
    s.ma_sach,
    s.isbn,
    s.ten_sach,
    tg.ds_tac_gia,
    tl.ten_the_loai,
    nxb.ten_nxb,
    s.nam_xuat_ban,
    s.ngon_ngu,
    COALESCE(b.so_ban_san_sang, 0) AS so_ban_san_sang
FROM sach s
JOIN the_loai tl ON tl.id = s.the_loai_id
JOIN nha_xuat_ban nxb ON nxb.id = s.nxb_id
LEFT JOIN (
    SELECT stg.sach_id,
           GROUP_CONCAT(t.ten_tac_gia ORDER BY t.ten_tac_gia SEPARATOR ', ') AS ds_tac_gia
    FROM sach_tac_gia stg
    JOIN tac_gia t ON t.id = stg.tac_gia_id
    GROUP BY stg.sach_id
) tg ON tg.sach_id = s.id
LEFT JOIN (
    SELECT sach_id, SUM(tinh_trang = 'SAN_SANG') AS so_ban_san_sang
    FROM ban_sach
    GROUP BY sach_id
) b ON b.sach_id = s.id;

-- ===== 08_security.sql =====
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
-- * Chỉ được ghi trực tiếp vào danh mục (sách, tác giả...), nhập bản sách/sửa vị trí kệ và hồ sơ người dùng.
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
GRANT SELECT, INSERT, UPDATE ON qltv_nhom8.nguoi_dung TO 'r_qltv_thuthu';
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

GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_tao_phieu_muon TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_them_sach_vao_phieu TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_huy_phieu_muon TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_tra_sach TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_gia_han TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_dat_truoc TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_huy_dat_truoc TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_thanh_toan_phat TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_cap_nhat_tinh_trang_ban_sach TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_tra_cuu_sach TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_cursor_danh_dau_qua_han TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_cursor_het_han_dat_truoc TO 'r_qltv_thuthu';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_cursor_thong_ke_muon_theo_nguoi_dung TO 'r_qltv_thuthu';

-- sp_huy_phat (hủy phiếu phạt) không cấp cho thủ thư: chỉ quản trị (ALL PRIVILEGES) dùng được.

-- Bạn đọc: chỉ tra cứu, đặt/hủy đặt trước và xem sách đang mượn, tiền phạt của mình.
-- Lưu ý: đây là tài khoản MySQL dùng chung cho tầng ứng dụng; ứng dụng phải xác thực bằng bảng tai_khoan
-- rồi truyền đúng mã người dùng vào các procedure (xem docs/04_quan_ly_thong_tin.md).
GRANT SELECT ON qltv_nhom8.vw_danh_muc_sach TO 'r_qltv_bandoc';
GRANT SELECT ON qltv_nhom8.vw_tra_cuu_sach TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_tra_cuu_sach TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_dat_truoc TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_huy_dat_truoc TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_bandoc_sach_dang_muon TO 'r_qltv_bandoc';
GRANT EXECUTE ON PROCEDURE qltv_nhom8.sp_bandoc_tien_phat TO 'r_qltv_bandoc';

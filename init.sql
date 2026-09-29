-- ============================================================
-- DATABASE INITIALIZATION SCRIPT FOR DOCKER
-- Database: qltv_nhom8 (Created via MYSQL_DATABASE env var)
-- ============================================================

-- 1. DANH MỤC CƠ BẢN
CREATE TABLE IF NOT EXISTS the_loai (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_the_loai VARCHAR(20) NOT NULL UNIQUE,
    ten_the_loai VARCHAR(120) NOT NULL,
    mo_ta VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nha_xuat_ban (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_nxb VARCHAR(20) NOT NULL UNIQUE,
    ten_nxb VARCHAR(160) NOT NULL,
    dia_chi VARCHAR(255),
    email VARCHAR(120),
    sdt VARCHAR(20)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tac_gia (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_tac_gia VARCHAR(20) NOT NULL UNIQUE,
    ten_tac_gia VARCHAR(160) NOT NULL,
    quoc_tich VARCHAR(80),
    nam_sinh SMALLINT
) ENGINE=InnoDB;

-- 2. NGƯỜI DÙNG VÀ TÀI KHOẢN
CREATE TABLE IF NOT EXISTS nguoi_dung (
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

CREATE TABLE IF NOT EXISTS tai_khoan (
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

-- 3. QUẢN LÝ SÁCH VÀ BẢN SÁCH
CREATE TABLE IF NOT EXISTS sach (
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

CREATE TABLE IF NOT EXISTS sach_tac_gia (
    sach_id BIGINT NOT NULL,
    tac_gia_id BIGINT NOT NULL,
    PRIMARY KEY (sach_id, tac_gia_id),
    CONSTRAINT fk_stg_sach FOREIGN KEY (sach_id) REFERENCES sach(id),
    CONSTRAINT fk_stg_tac_gia FOREIGN KEY (tac_gia_id) REFERENCES tac_gia(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ban_sach (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ma_ban_sach VARCHAR(30) NOT NULL UNIQUE,
    sach_id BIGINT NOT NULL,
    vi_tri_ke VARCHAR(50) NOT NULL,
    ngay_nhap DATE NOT NULL,
    tinh_trang VARCHAR(20) NOT NULL DEFAULT 'SAN_SANG',
    CONSTRAINT fk_bs_sach FOREIGN KEY (sach_id) REFERENCES sach(id),
    CONSTRAINT chk_bs_tinh_trang CHECK (tinh_trang IN ('SAN_SANG','DANG_MUON','HU_HONG','MAT','NGUNG_PHUC_VU'))
) ENGINE=InnoDB;

-- 4. QUẢN LÝ MƯỢN TRẢ VÀ PHẠT
CREATE TABLE IF NOT EXISTS phieu_muon (
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

CREATE TABLE IF NOT EXISTS ct_phieu_muon (
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

CREATE TABLE IF NOT EXISTS phieu_phat (
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

-- 5. ĐẶT TRƯỚC VÀ NHẬT KÝ
CREATE TABLE IF NOT EXISTS dat_truoc (
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

CREATE TABLE IF NOT EXISTS nhat_ky_hanh_vi (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nguoi_dung_id BIGINT,
    loai_hanh_vi VARCHAR(30) NOT NULL,
    doi_tuong VARCHAR(50),
    doi_tuong_id BIGINT,
    mo_ta VARCHAR(255),
    thoi_gian DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_nkhv_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung(id)
) ENGINE=InnoDB;

-- INDEXES
CREATE INDEX idx_sach_ten ON sach(ten_sach);
CREATE INDEX idx_bs_tinh_trang ON ban_sach(tinh_trang);
CREATE INDEX idx_ctpm_han_tra ON ct_phieu_muon(han_tra, ngay_tra);
CREATE INDEX idx_pp_trang_thai ON phieu_phat(trang_thai);
CREATE INDEX idx_dt_trang_thai ON dat_truoc(trang_thai);


-- ============================================================
-- MOCK DATA INSERTION
-- ============================================================

-- 1. Thể loại
INSERT INTO the_loai (ma_the_loai, ten_the_loai, mo_ta) VALUES
('TL01', 'CNTT & Lap trinh', 'Sach ve khoa hoc may tinh, lap trinh va cong nghe'),
('TL02', 'Kinh te & Quan tri', 'Sach quan tri kinh doanh, tài chinh va marketing'),
('TL03', 'Vat ly & Ky thuat', 'Giao trinh ky thuat, vat ly ly thuyet va ung dung');

-- 2. Nhà xuất bản
INSERT INTO nha_xuat_ban (ma_nxb, ten_nxb, dia_chi, email, sdt) VALUES
('NXB01', 'NXB Bach Khoa Ha Noi', 'So 1 Dai Co Viet, Ha Noi', 'contact@nxbbachkhoa.vn', '02438692222'),
('NXB02', 'NXB Thong tin va Truyhen thong', '115 Tran Duy Hung, Ha Noi', 'nxb.tttt@mic.gov.vn', '02435567999'),
('NXB03', 'NXB Tre', '161B Ly Chinh Thang, Q.3, TP.HCM', 'hopthu@nxbtre.com.vn', '02839316289');

-- 3. Tác giả
INSERT INTO tac_gia (ma_tac_gia, ten_tac_gia, quoc_tich, nam_sinh) VALUES
('TG01', 'Robert C. Martin', 'Mỹ', 1952),
('TG02', 'Pham Huu Lo', 'Việt Nam', 1965),
('TG03', 'Erich Gamma', 'Thụy Sĩ', 1961);

-- 4. Người dùng (Cán bộ / Thủ thư, Giảng viên, Sinh viên)
INSERT INTO nguoi_dung (ma_nguoi_dung, ho_ten, loai_nguoi_dung, email, sdt, khoa_don_vi, trang_thai) VALUES
('ND001', 'Nguyen Van Admin', 'CAN_BO', 'admin@library.edu.vn', '0901234567', 'Trung tam Thong tin Thu vien', 'HOAT_DONG'),
('ND002', 'Tran Thi Thu Thu', 'CAN_BO', 'thuthu@library.edu.vn', '0902345678', 'Trung tam Thong tin Thu vien', 'HOAT_DONG'),
('ND003', 'Le Hoang Nam', 'GIANG_VIEN', 'nam.lh@university.edu.vn', '0903456789', 'Khoa CNTT', 'HOAT_DONG'),
('ND004', 'Pham Minh Tuan', 'SINH_VIEN', 'tuan.pm20123@sis.edu.vn', '0904567890', 'Khoa CNTT', 'HOAT_DONG');

-- 5. Tài khoản
INSERT INTO tai_khoan (nguoi_dung_id, ten_dang_nhap, mat_khau_hash, vai_tro, trang_thai) VALUES
(1, 'admin', '$2a$12$eImiTXuWVxfM37uY4JANjOL.81F8RzH23Y98z1H0g/X2pD/6WkE/S', 'ADMIN', 'HOAT_DONG'),
(2, 'thuthu01', '$2a$12$eImiTXuWVxfM37uY4JANjOL.81F8RzH23Y98z1H0g/X2pD/6WkE/S', 'THU_THU', 'HOAT_DONG'),
(3, 'namlh', '$2a$12$eImiTXuWVxfM37uY4JANjOL.81F8RzH23Y98z1H0g/X2pD/6WkE/S', 'BAN_DOC', 'HOAT_DONG'),
(4, 'tuanpm', '$2a$12$eImiTXuWVxfM37uY4JANjOL.81F8RzH23Y98z1H0g/X2pD/6WkE/S', 'BAN_DOC', 'HOAT_DONG');

-- 6. Sách & Tác giả sách
INSERT INTO sach (ma_sach, isbn, ten_sach, the_loai_id, nxb_id, nam_xuat_ban, ngon_ngu, mo_ta) VALUES
('S001', '9780132350884', 'Clean Code: A Handbook of Agile Software Craftsmanship', 1, 2, 2008, 'Tieng Anh', 'Huong dan viet ma sach va de bao tri'),
('S002', '9780201633610', 'Design Patterns: Elements of Reusable Object-Oriented Software', 1, 1, 1994, 'Tieng Anh', 'Cac mau thiet ke huong doi tuong kinh dien');

INSERT INTO sach_tac_gia (sach_id, tac_gia_id) VALUES
(1, 1),
(2, 3);

-- 7. Bản sách (Các cuốn sách vật lý trên kệ)
INSERT INTO ban_sach (ma_ban_sach, sach_id, vi_tri_ke, ngay_nhap, tinh_trang) VALUES
('BS001-1', 1, 'Ke A1-01', '2023-01-15', 'SAN_SANG'),
('BS001-2', 1, 'Ke A1-01', '2023-01-15', 'DANG_MUON'),
('BS002-1', 2, 'Ke B2-05', '2023-02-10', 'SAN_SANG');

-- 8. Phiếu mượn & Chi tiết phiếu mượn
INSERT INTO phieu_muon (ma_phieu, nguoi_dung_id, nhan_vien_id, ngay_muon, trang_thai) VALUES
('PM001', 4, 2, '2026-09-15', 'DANG_MUON');

INSERT INTO ct_phieu_muon (phieu_muon_id, ban_sach_id, han_tra, so_lan_gia_han) VALUES
(1, 2, '2026-09-29', 0);

-- 9. Đặt trước
INSERT INTO dat_truoc (nguoi_dung_id, sach_id, trang_thai) VALUES
(3, 1, 'CHO_XU_LY');

-- 10. Nhật ký hành vi
INSERT INTO nhat_ky_hanh_vi (nguoi_dung_id, loai_hanh_vi, doi_tuong, doi_tuong_id, mo_ta) VALUES
(4, 'MUON_SACH', 'phieu_muon', 1, 'Sinh vien mron sach Clean Code');
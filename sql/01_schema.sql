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

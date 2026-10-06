// Giá trị các cột có CHECK constraint trong sql/01_schema.sql.
// `prisma db pull` coi các cột này là String nên enum được giữ ở đây, không đặt trong schema.prisma.

export enum LoaiNguoiDung {
  SINH_VIEN = 'SINH_VIEN',
  GIANG_VIEN = 'GIANG_VIEN',
  CAN_BO = 'CAN_BO',
}

export enum TrangThaiNguoiDung {
  HOAT_DONG = 'HOAT_DONG',
  TAM_KHOA = 'TAM_KHOA',
  NGUNG = 'NGUNG',
}

export enum VaiTroTaiKhoan {
  ADMIN = 'ADMIN',
  THU_THU = 'THU_THU',
  BAN_DOC = 'BAN_DOC',
}

export enum TrangThaiTaiKhoan {
  HOAT_DONG = 'HOAT_DONG',
  KHOA = 'KHOA',
}

export enum TinhTrangBanSach {
  SAN_SANG = 'SAN_SANG',
  DANG_MUON = 'DANG_MUON',
  DANG_GIU = 'DANG_GIU',
  HU_HONG = 'HU_HONG',
  MAT = 'MAT',
  NGUNG_PHUC_VU = 'NGUNG_PHUC_VU',
}

export enum TrangThaiPhieuMuon {
  DANG_MUON = 'DANG_MUON',
  HOAN_TAT = 'HOAN_TAT',
  HUY = 'HUY',
}

export enum TinhTrangTra {
  BINH_THUONG = 'BINH_THUONG',
  HU_HONG = 'HU_HONG',
  MAT = 'MAT',
}

export enum LoaiPhat {
  QUA_HAN = 'QUA_HAN',
  HU_HONG = 'HU_HONG',
  MAT_SACH = 'MAT_SACH',
}

export enum TrangThaiPhieuPhat {
  CHUA_THANH_TOAN = 'CHUA_THANH_TOAN',
  DA_THANH_TOAN = 'DA_THANH_TOAN',
  HUY = 'HUY',
}

export enum TrangThaiDatTruoc {
  CHO_XU_LY = 'CHO_XU_LY',
  SAN_SANG_NHAN = 'SAN_SANG_NHAN',
  DA_NHAN = 'DA_NHAN',
  HUY = 'HUY',
  HET_HAN = 'HET_HAN',
}

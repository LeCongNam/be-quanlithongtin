# Thay đổi API khi đồng bộ DB mới (database_info, rà soát lần 2 – mục #40–#48)

Ngày: 2026-10-06. Ghi chú cho FE. Chi tiết request/response xem Swagger `/docs`.

## Đổi hợp đồng (FE phải sửa)

| Endpoint | Trước | Sau |
|---|---|---|
| `POST /sach` | `theLoaiId`, `nxbId`, `tacGiaIds: number[]` | `maTheLoai`, `maNxb`, `maTacGias?: string[]` (mã). Mã sai thì không thêm gì, trả 422 |
| `PATCH /sach/:id` | `theLoaiId`, `nxbId`, `tacGiaIds` | `maTheLoai`, `maNxb`, `maTacGias` (mã không tồn tại thì trả 404) |
| `POST /sach/:id/ban-sach` | `{ maBanSach, viTriKe, ngayNhap }`, trả 1 bản | `{ soBan (1–100, mặc định 1), viTriKe }`. Mã `BSnnn` do DB tự sinh, ngày nhập là hôm nay. Trả mảng `[{ ma_ban_sach, vi_tri_ke, tinh_trang }]`. Nếu đầu sách đang có người chờ, bản mới có tình trạng `DANG_GIU` |
| `POST /docgia`, `PATCH /docgia/:id` | có `trangThai` | Bỏ `trangThai` (nếu gửi lên sẽ bị bỏ qua). Người mới luôn `HOAT_DONG` |
| `POST /muon-tra/gia-han` (bạn đọc gia hạn sách của người khác) | 403 | **422** (DB báo như không có lượt mượn) |
| `GET /sach?tuKhoa=` | | Từ khóa chỉ toàn khoảng trắng thì trả danh mục có phân trang. `% _ \` được hiểu theo nghĩa đen. Tìm được tiếng Việt ngắn ("cơ sở") |

## Endpoint mới

- `PATCH /docgia/:id/trang-thai` `{ trangThai: HOAT_DONG | TAM_KHOA | NGUNG }`: dành cho ADMIN và THU_THU. Thủ thư không đổi được trạng thái cán bộ (403). Đổi sang trạng thái đang có thì trả 422. Khi người dùng rời `HOAT_DONG`, tài khoản tự bị `KHOA`; mở lại người dùng thì tài khoản **vẫn KHOA**.
- `PATCH /docgia/:id/tai-khoan/trang-thai` `{ trangThai: HOAT_DONG | KHOA }`: chỉ ADMIN. Mở tài khoản khi người dùng chưa `HOAT_DONG` thì trả 422.
- `GET /me/lich-su-muon`: lịch sử mượn (cả đang mượn và đã trả), mới nhất trước.
- `GET /me/dat-truoc`: lượt đặt trước của tôi, gồm `thu_tu_cho` (vị trí trong hàng đợi), `ma_ban_sach` và `han_giu` khi đã được giữ bản.
- `GET /bao-cao/thong-ke-tien-phat`: thống kê theo tháng × loại phạt (`so_phieu`, `tong_tien`, `da_thanh_toan`, `chua_thanh_toan`, `so_phieu_huy`).
- `GET /bao-cao/lich-su-muon?maNguoiDung=`
- `GET /bao-cao/dat-truoc?maNguoiDung=&trangThai=`

## Không đổi với FE

- `DELETE /docgia/:id` vẫn chuyển người dùng sang `NGUNG`. Riêng người dùng là cán bộ thì chỉ ADMIN được làm.
- `GET /me/sach-dang-muon` và `GET /me/tien-phat` giữ nguyên cột.
- Lỗi nghiệp vụ do trigger chặn khi ghi dữ liệu trước đây có chỗ trả 500, nay trả 422 kèm thông báo của DB.

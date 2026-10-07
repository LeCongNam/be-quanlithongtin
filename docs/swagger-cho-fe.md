# Swagger cho FE

BE chạy ở `http://localhost:3000` (đổi bằng `PORT`).

| Đường dẫn | Nội dung |
|---|---|
| `/docs` | Swagger UI: đọc mô tả, thử gọi API |
| `/docs-json`, `/docs-yaml` | Đặc tả OpenAPI 3 để máy đọc (sinh kiểu/client) |
| `docs/openapi.json` | Bản chụp đặc tả trong repo, sinh bằng `npm run openapi:export` |

## Thử API trên Swagger UI

1. Mở `/docs`, chạy `POST /auth/login` với `{"tenDangNhap":"ad001","matKhau":"AD001@Nhom8"}`, copy `accessToken`.
2. Bấm **Authorize**, dán token (không gõ chữ `Bearer`). Token được nhớ khi tải lại trang.
3. Mỗi endpoint có dòng **Quyền** (ADMIN / THU_THU / mọi tài khoản đã đăng nhập / công khai), danh sách mã lỗi và schema response.

Tài khoản seed: `ad001` (ADMIN), `cb001`, `cb002` (THU_THU), `sv001`–`sv008`, `gv001`, `gv002` (BAN_DOC); mật khẩu demo `<MÃ NGƯỜI DÙNG VIẾT HOA>@Nhom8`, ví dụ `SV002@Nhom8`. `sv007` đang bị khóa (đăng nhập trả 401).

## Quy ước dữ liệu

- Khóa chính BIGINT (`id`) là **chuỗi** (`"13"`); tham số đường dẫn như `/sach/{id}` cũng là chuỗi số. Khi gọi API nghiệp vụ dùng **mã** (`maSach`, `maBanSach`, `maNguoiDung`, `maPhieu`), không dùng `id`.
- Danh sách có phân trang trả `{ data, total, page, limit }`; query `page` (từ 1) và `limit` (tối đa 100) đều tùy chọn.
- Sắp xếp: `sapXep=<field>:<asc|desc>` (tùy chọn) ở `/sach` (`tenSach`, `maSach`, `namXuatBan`, `soBanSanSang`), `/docgia` (`maNguoiDung`, `hoTen`), `/phieu-muon` (`ngayMuon`, `maPhieu`), `/phat` (`ngayTao`, `soTien`), `/dat-truoc` (`ngayDat`, `hanGiu`). Field ngoài danh sách trả 400. Không truyền thì dùng thứ tự mặc định trong mô tả từng endpoint; `/phat` và `/dat-truoc` mặc định đưa nhóm cần xử lý lên trước, còn khi có `sapXep` thì sort thuần theo cột. Ô trống (vd. `hanGiu`) luôn nằm cuối.
- Ngày kiểu DATE trả dạng ISO `2026-10-07T00:00:00.000Z`; hiển thị theo ngày, không đổi múi giờ.
- Báo cáo (`/bao-cao/*`), `GET /sach` và `/me/*` giữ tên cột **snake_case** của view; các endpoint còn lại là camelCase.
- Số đếm và tiền VND trong báo cáo và `/me` là number. `soTien`, `giaBia` đọc từ bảng là chuỗi thập phân.
- Enum (vai trò, trạng thái, tình trạng bản sách...) có tên trong `components.schemas` (`VaiTroTaiKhoan`, `TinhTrangBanSach`, ...).
- Lỗi luôn có dạng `{ statusCode, message }` (`ErrorResponseDto`). `400` message là mảng lỗi validate; `401` chưa đăng nhập, token hết hạn hoặc tài khoản bị khóa (kể cả giữa phiên); `403` sai vai trò; `409` trùng hoặc vướng khóa ngoại; `422` vi phạm quy tắc nghiệp vụ, `message` là thông báo của CSDL để hiển thị cho người dùng.
- Mỗi endpoint có `operationId` dạng `Sach_traCuu`, `MuonTra_giaHan` để công cụ sinh code đặt tên hàm.

## Sinh kiểu TypeScript cho FE (tùy chọn)

```bash
npx openapi-typescript ../BE/docs/openapi.json -o lib/api-types.ts
```

Hoặc trỏ thẳng vào `http://localhost:3000/docs-json` khi BE đang chạy.

## Cập nhật đặc tả

Sau khi đổi controller/DTO, chạy trong `BE/`:

```bash
npm run openapi:export
```

Lệnh này build rồi ghi `docs/openapi.json`, không cần DB. Phải build bằng `nest build` (không dùng vitest) vì plugin Swagger của Nest CLI suy ra schema của request DTO lúc build.

> Lưu ý: nếu đường dẫn thư mục dự án chứa chữ tiếng Việt có dấu ở dạng tổ hợp (macOS hay sinh ra khi gõ tên thư mục), plugin Swagger sinh sai đường dẫn `import` và `node dist/main` báo `ERR_MODULE_NOT_FOUND`. Chạy BE từ thư mục có đường dẫn ASCII (ví dụ `~/qltv/BE`).

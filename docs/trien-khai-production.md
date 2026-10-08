# Triển khai lên Internet (Vercel + Railway)

Kiến trúc: trình duyệt → **FE (Vercel)** → rewrite `/backend/*` → **BE (Railway)** → **MySQL 8 (Railway)**.

FE gọi BE qua proxy `/backend` của Next (`FE/next.config.ts`), nên trình duyệt chỉ nói chuyện với một origin, không cần cấu hình CORS cho domain FE.

Chưa có tên miền riêng thì dùng tên miền miễn phí do nền tảng cấp (`xxx.vercel.app`, `xxx.up.railway.app`). Khi mua domain, chỉ cần thêm vào Vercel (Settings → Domains) rồi trỏ DNS theo hướng dẫn của Vercel; BE giữ nguyên.

Thứ tự làm: **1. Database → 2. BE → 3. FE**.

## 0. Chuẩn bị mật khẩu

Tạo 2 chuỗi ngẫu nhiên, lưu vào trình quản lý mật khẩu (đừng commit):

```bash
openssl rand -hex 24      # mật khẩu user MySQL "qltt"
openssl rand -base64 48   # JWT_SECRET
```

## 1. Database (Railway MySQL)

1. Railway → New Project → Add → Database → **MySQL** (bản 8.x).
2. Mở service MySQL → tab **Variables**, lấy mật khẩu root; tab **Settings → Networking** bật **TCP Proxy** (cổng 3306) để nạp dữ liệu từ máy bạn. Ghi lại host và port proxy.
3. Nạp schema và dữ liệu mẫu (từ thư mục `BE/`). File này `DROP DATABASE qltv_nhom8` rồi tạo lại, nên chỉ chạy lúc DB còn trống:

```bash
mysql -h <PROXY_HOST> -P <PROXY_PORT> -uroot -p --default-character-set=utf8mb4 < sql/99_full_setup.sql
```

`--default-character-set=utf8mb4` bắt buộc, nếu thiếu tiếng Việt trong dữ liệu bị mã hóa đôi.

4. Tạo user kết nối của BE với quyền tối thiểu (khác `docker/02_service_user.sql` ở chỗ mật khẩu là chuỗi ngẫu nhiên bạn vừa tạo):

```bash
mysql -h <PROXY_HOST> -P <PROXY_PORT> -uroot -p --default-character-set=utf8mb4 -e "
CREATE USER 'qltt'@'%' IDENTIFIED BY '<MAT_KHAU_QLTT>';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON qltv_nhom8.* TO 'qltt'@'%';"
```

5. Kiểm tra event lập lịch (hết hạn giữ sách chạy bằng event):

```sql
SELECT @@event_scheduler;           -- phải là ON
SELECT event_name, status FROM information_schema.events WHERE event_schema = 'qltv_nhom8';
```

Nếu là `OFF`: `SET GLOBAL event_scheduler = ON;` (mất khi MySQL khởi động lại; MySQL 8 mặc định là ON nên thường không cần).

6. Sau khi xong, **tắt TCP Proxy** nếu không cần nạp thêm, để cổng DB không mở ra Internet.

> Phân quyền theo vai trò (`08b_create_users.sql`, `11_demo_bao_mat.sql`) là phần demo bảo mật tầng CSDL, không cần cho bản chạy web. Không chạy trên server công khai trừ khi bạn đặt mật khẩu mạnh cho từng user.

## 2. Backend (Railway)

1. Trong cùng project: New → GitHub Repo → chọn repo BE (có `Dockerfile` ở gốc nên Railway tự build bằng Docker). Nếu BE nằm trong thư mục con của repo, đặt **Root Directory** = `BE`.
2. Tab **Variables** của service BE:

| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | `mysql://qltt:<MAT_KHAU_QLTT>@<HOST_NOI_BO>:3306/qltv_nhom8` — host nội bộ của service MySQL (dạng `mysql.railway.internal`, xem biến `MYSQLHOST`/`RAILWAY_PRIVATE_DOMAIN`) |
| `JWT_SECRET` | chuỗi `openssl rand -base64 48` ở bước 0 |
| `JWT_EXPIRES_IN` | `8h` |
| `CORS_ORIGINS` | domain FE, ví dụ `https://xxx.vercel.app` (chỉ cần nếu trình duyệt gọi thẳng BE; qua proxy `/backend` thì không bắt buộc) |

   Không đặt `PORT`: Railway tự cấp, `main.ts` đọc `process.env.PORT`. Nếu mật khẩu có ký tự đặc biệt trong URL thì phải mã hóa phần trăm; chuỗi `openssl rand -hex` thì không gặp vấn đề này.

3. Settings → Networking → **Generate Domain**, được dạng `https://be-xxx.up.railway.app`.
4. Kiểm tra: mở `https://be-xxx.up.railway.app/docs` (Swagger UI) hoặc gọi thử:

```bash
curl -s -X POST https://be-xxx.up.railway.app/auth/login \
  -H 'content-type: application/json' \
  -d '{"tenDangNhap":"sv001","matKhau":"SV001@Nhom8"}'
```

Trả về token là BE nối được DB. Swagger đang công khai ở `/docs`; nếu không muốn lộ danh sách API thì bỏ `setupSwagger(app)` trong `src/main.ts` khi chạy production.

## 3. Frontend (Vercel)

1. Vercel → Add New Project → import repo FE (Next.js tự nhận). Nếu FE nằm trong thư mục con, đặt **Root Directory** = `FE`.
2. Environment Variables:

| Biến | Giá trị |
|---|---|
| `API_BASE_URL` | `https://be-xxx.up.railway.app` (không có dấu `/` cuối) |

   Biến này được `next.config.ts` đọc **lúc build**, nên đổi giá trị thì phải Redeploy.
3. Deploy, mở `https://xxx.vercel.app`, đăng nhập thử.

## 4. Tài khoản demo trên bản công khai

Dữ liệu mẫu giữ nguyên theo quyết định của nhóm, nên **bất kỳ ai biết link đều đăng nhập được `ad001` / `AD001@Nhom8` (quản trị)**; mật khẩu nằm trong `user.md` và trong seed. Chấp nhận được cho bản demo chấm điểm, nhưng cần biết:

- Người lạ xóa hoặc sửa được dữ liệu. Muốn đưa về trạng thái ban đầu: nạp lại `sql/99_full_setup.sql` (bước 1.3) rồi chạy lại bước 1.4 (`DROP USER IF EXISTS 'qltt'@'%'` trước khi tạo, vì `99_full_setup.sql` không giữ user này).
- `/auth/login` chưa giới hạn số lần thử sai (ghi trong mục hạn chế). Nếu để công khai lâu, thêm rate-limit ở BE hoặc đổi mật khẩu admin/thủ thư.
- Không dùng dữ liệu thật của người dùng trên bản này.

## 5. Khi sửa DB về sau

`sql/99_full_setup.sql` xóa sạch dữ liệu. Với DB đã có dữ liệu thật, không nạp lại; chỉ chạy riêng file thay đổi (ví dụ `04_procedures.sql`), rồi cấp lại `EXECUTE` cho `qltt` nếu procedure bị tạo lại làm mất quyền.

## 6. Kiểm tra sau triển khai

- [ ] Đăng nhập được bằng tài khoản quản trị, thủ thư, bạn đọc
- [ ] Danh sách sách hiển thị đúng tiếng Việt (không có ký tự lỗi `Ã`, `á»`)
- [ ] Lập phiếu mượn và trả sách thành công
- [ ] `SELECT @@event_scheduler` là `ON`
- [ ] TCP Proxy của MySQL đã tắt
- [ ] File `.env`, mật khẩu không nằm trong git

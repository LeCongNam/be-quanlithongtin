# Nhật ký thay đổi — nhánh `trongminh` so với `main` (repo BE)

> Lập ngày 2026-10-07 từ `git log main..HEAD` và `git diff main`.
> Mốc so sánh: `main` = `origin/main` = `9930a95` (Fix docker compose). Đầu nhánh: `097e90c` (commit file log này); commit code cuối: `04bd8b9`.
> Working tree sạch (mọi thay đổi đã commit). Nhánh **chưa push** (người dùng dặn BE chỉ commit, không push).

## 1. Tổng quan

| Chỉ số | Giá trị |
|---|---|
| Số commit trên `main` | 29 (tác giả `minh`; 28 commit code + 1 commit file log này), 2026-10-06 11:20 → 2026-10-07 |
| File thay đổi | 114 (89 thêm, 24 sửa, 1 xóa) |
| Dòng | +24.043 / −1.006 (phần lớn là `docs/openapi.json` 8.715, `sql/*` ~6.000, `yarn.lock` 3.038) |
| Stack | NestJS + Prisma + MySQL 8.0 (DB `qltv_nhom8`, bản v2.2 đóng băng) |
| Kiểm thử | unit 21/21, e2e 46/46, lint + tsc sạch (đo trước commit `04bd8b9`) |

`main` chỉ chứa bản SQL tham khảo ban đầu và docker compose. Toàn bộ code NestJS, auth, các module nghiệp vụ, Swagger và module demo nằm trên nhánh này.

## 2. Dòng thời gian commit

### Đợt 1 — 2026-10-06 11:20: dựng khung BE trên schema chuẩn
| Commit | Nội dung | Quy mô |
|---|---|---|
| `2fbcd44` | Dùng schema chuẩn từ `database_info`, nạp vào docker | 14 file, +2432/−605 |
| `b4433ce` | Sinh lại Prisma schema từ DB mới, chuyển enum sang TS | 3 file |
| `afadfcc` | Filter lỗi DB, BigInt→JSON, Swagger ban đầu | 9 file |
| `c92cbac` | Đăng nhập JWT, guard theo vai trò | 12 file |
| `8e60db9` | CRUD độc giả (docgia) và tạo tài khoản | 6 file |
| `b64fe97` | Module danh mục và sách | 13 file |
| `4367520` | Module mượn trả, đặt trước, phạt | 15 file |
| `a31624b` | API bạn đọc tự phục vụ (`/me`) và báo cáo | 5 file |
| `d01c542` | e2e test cho auth và luồng thư viện | 1 file, +348 |
| `acb877b` | Thêm `CLAUDE.md` (hướng dẫn dự án, quy tắc đặt tên nhánh) | 1 file |

### Đợt 2 — 2026-10-06 17:56: đồng bộ DB v2 (#40–#48)
| Commit | Nội dung |
|---|---|
| `f9b8b74` | Đồng bộ `sql/` với `database_info` v2 (12 file, +2650) |
| `0535a2b` | Pull lại Prisma schema: `phien_dang_nhap`, khóa ngoại kép của `dat_truoc` |
| `041c86c` | Trigger SIGNAL phát sinh từ ghi qua Prisma model được map thành 422 |
| `5ca3f1e` | Phiếu mượn nhiều lệnh gọi chạy chung transaction của người gọi (`autocommit=0`) — thêm `proc-transaction.ts` |
| `99469ac` | Bạn đọc gia hạn qua `sp_gia_han_luot_muon` |
| `8bdf2d0` | `/me/*` đọc từ view; thêm lịch sử mượn và đặt trước |
| `08d84dc` | Thêm sách và bản sách qua `sp_them_sach`, `sp_them_ban_sach` |
| `746c626` | Đổi trạng thái độc giả qua procedure; ADMIN mở khóa tài khoản |
| `f33de17` | Báo cáo mới: thống kê phạt, lịch sử mượn, đặt trước |
| `64835d3` | Cập nhật e2e theo hành vi DB v2 (+196) |
| `f9b3cda` | Tài liệu `docs/thay-doi-api-db-v2.md` cho FE |

### Đợt 3 — 2026-10-07 10:59: DB v2.2
| Commit | Nội dung |
|---|---|
| `f566f4b` | Đồng bộ `database_info` d48ee8a (lỗi #49, #50) vào `sql/`, gồm `11_demo_bao_mat.sql`. Không đổi hợp đồng API; unit 15/15, e2e 27/27 trên DB v2.2 sạch. Ghi vào docs: 422 khi đặt trước đầu sách đang mượn, `thu_tu_cho` có thể null, seed mới |
| `ff23abd` | "update md" (2 file, +2834 — chủ yếu `package-lock.json`) |

### Đợt 4 — 2026-10-07 11:51: xác thực hai tầng (B1–B5)
| Commit | Nội dung |
|---|---|
| `5d0aa53` | 13 file, +496/−32 (chi tiết ở mục 3.2) |

### Đợt 5 — 2026-10-07 13:29 → 15:45: Swagger, id sách, module demo
| Commit | Nội dung |
|---|---|
| `da300f5` | Swagger đầy đủ cho FE: response schema, mô tả endpoint, mã lỗi, CORS, xuất `openapi.json` (46 file, +9902) |
| `5538dd7` | Cập nhật `yarn.lock` |
| `5a6d196` | `GET /sach` trả thêm `id` để FE gọi `/sach/:id` (4 file) |
| `04bd8b9` | Module `src/demo` — xử lý thông tin: procedure, trigger, function, cursor (10 file, +1764) |

## 3. Thay đổi theo mảng chức năng

### 3.1 Nền tảng và dữ liệu
- Xóa `init.sql`. `sql/` là bản sao của `database_info/database` (01–11 và `99_full_setup.sql`, `build_full_setup.sh` để dựng lại). Không sửa tay `sql/`, vì lần sync sau sẽ ghi đè.
- `prisma/schema.prisma` sinh lại từ DB; enum chuyển sang `src/common/db-enums.ts`.
- `docker-compose.yml` bỏ `MYSQL_USER`/`MYSQL_PASSWORD`, mount `docker/02_service_user.sql` vào `initdb.d` sau `01_full_setup.sql`. `.env.example` thêm `CORS_ORIGINS`.
- `nest-cli.json` bật plugin Swagger của Nest; `package.json` thêm script `openapi:export`.
- Hạ tầng chung: `bigint-json.ts`, `parse-bigint.pipe.ts`, `call-rows.ts` (gọi procedure, ép cột đếm/tiền thành number), `proc-transaction.ts`, `page-query.dto.ts`, `error-response.dto.ts`.

### 3.2 Xác thực và phân quyền hai tầng (`5d0aa53`)
- **Tầng CSDL:** 3 user MySQL (`qltv_admin`, `qltv_thuthu`, `qltv_bandoc`) và 3 role `r_qltv_*`; tạo bằng `sql/08b_create_users.sql` (biến `@user_host`, mật khẩu `CHANGE_ME`, người dùng tự đặt, tối thiểu 12 ký tự). Bạn đọc dùng chung 1 user nên xác thực qua `sp_dang_nhap` → token (DB chỉ lưu SHA-256).
- **Tầng BE:**
  - B1 — mật khẩu thống nhất `SHA2(muối + mật khẩu)` hex (`src/common/password.ts`). Hash bcrypt cũ vẫn đọc được và được ghi lại sang SHA2 khi đăng nhập đúng.
  - B2 — `JwtAuthGuard` đọc `tai_khoan.trang_thai` và `nguoi_dung.trang_thai` mỗi request, tài khoản bị khóa nhận 401 ngay. `vaiTro` vẫn lấy từ JWT.
  - B3 — DELETE `the-loai`, `nha-xuat-ban`, `tac-gia` chỉ ADMIN (thủ thư nhận 403).
  - B4 — user MySQL `qltt` của BE chỉ có SELECT, INSERT, UPDATE, DELETE, EXECUTE (`docker/02_service_user.sql`).
  - B5 — viết lại docs theo mô hình hai tầng.
- Test mới: `password-hash.e2e-spec.ts`, `token-trang-thai.e2e-spec.ts`, `danh-muc-xoa.e2e-spec.ts`, `password.spec.ts`, `auth-helpers.spec.ts`.

### 3.3 Module nghiệp vụ (58 endpoint)
`auth`, `docgia`, `danh-muc` (thể loại / NXB / tác giả), `sach` (+ bản sách), `muon-tra`, `dat-truoc`, `phat`, `ban-doc` (`/me/*`), `bao-cao` (`/bao-cao/*`), `demo`. Mỗi module có controller, service, DTO request và DTO response.

### 3.4 Swagger/OpenAPI (`da300f5`)
- `src/openapi.ts` (`setupSwagger`): `/docs`, `/docs-json`, `/docs-yaml`; dòng "Quyền" và `x-roles` sinh từ metadata `@Roles`/`@Public` thật.
- `*.response.dto.ts` cho mọi module, decorator `ApiErrors` và `ApiPaginatedResponse`, `@ApiOperation` cho đủ 58 endpoint.
- `npm run openapi:export` → `docs/openapi.json`; thêm `docs/swagger-cho-fe.md`; test `openapi.e2e-spec.ts`.
- Đã đối chiếu 90 lời gọi thật (42 đọc, 48 ghi) với schema: khớp hết.
- Sửa kèm:
  - Cột đếm/tiền của `GET /sach` và `/bao-cao/*` trả number (`numberColumns` trong `call-rows.ts`; trước là chuỗi).
  - Lỗi khóa ngoại MySQL 1217/1451/1452 trả 409 thay vì 500 (`database-exception.filter.ts`).
  - `PartialType` phải import từ `@nestjs/swagger`.

### 3.5 `GET /sach` trả `id` (`5a6d196`)
`vw_tra_cuu_sach` không có `id` nên FE không gọi được `/sach/{id}`. `sach.service.ts` thêm `kemId()` gắn `id` theo `ma_sach` (cả nhánh `tuKhoa` lẫn view), `TraCuuSachDto` thêm `id`, xuất lại `openapi.json`, ghi vào `docs/thay-doi-api-db-v2.md`.

### 3.6 Module demo xử lý thông tin (`04bd8b9`)
- API chỉ dành cho staff: `GET /demo`, `GET /demo/:id`, `POST /demo/:id/bang {thamSo}`, `POST /demo/:id/chay {thamSo, hoanTac=true}`.
- 16 mục: 5 procedure (`sp_tra_cuu_sach`, `sp_tra_sach`, `sp_gia_han`, `sp_dat_truoc`, `sp_thanh_toan_phat`), 5 trigger, 3 function, 3 cursor.
- `chay` chạy trong `autocommit=0`, đọc bảng **sau** khi chạy rồi ROLLBACK (mặc định). Lỗi SIGNAL trả HTTP 200 kèm trường `loi`.
- Câu SQL hiển thị lấy từ `sql/03..06_*.sql` (`SHOW CREATE` trả NULL với user `qltt`).
- `DatabaseExceptionFilter.map` đổi từ private sang public để module demo dùng lại.
- Bám yêu cầu đề: web demo theo 5 bước cho từng Procedure / Trigger / Function / Cursor.

## 4. Hợp đồng API cho FE (trạng thái hiện tại)
- Khóa chính BIGINT là **chuỗi** (`"13"`). Nghiệp vụ gọi bằng **mã** (`maSach`, `maBanSach`, `maNguoiDung`, `maPhieu`).
- Phân trang: `{data, total, page, limit}`, `page` từ 1, `limit` ≤ 100.
- `/bao-cao/*`, `GET /sach` và `/me/*` giữ tên cột snake_case; endpoint khác dùng camelCase.
- Lỗi `{statusCode, message}`: 400 (message là mảng validate), 401 (chưa đăng nhập / token hết hạn / tài khoản bị khóa giữa phiên), 403 (sai vai trò), 409 (trùng hoặc còn khóa ngoại), 422 (vi phạm nghiệp vụ, message DB hiện nguyên văn).
- Phân quyền:
  - Chỉ ADMIN: xóa danh mục, hủy phạt, tạo/khóa tài khoản.
  - ADMIN + THU_THU: thêm/sửa danh mục, sách, bản sách; lập phiếu; trả sách; thanh toán phạt; quản lý người dùng.
  - Mọi tài khoản: `/me/*`, đặt trước, gia hạn.
  - Staff: `/bao-cao/*`, `/demo/*`.
- Gotcha nghiệp vụ: đặt trước đầu sách đang mượn → 422; `thu_tu_cho = null` nghĩa là chưa đủ điều kiện (không phải lỗi); bản sách nhập mới thành `DANG_GIU` nếu có người chờ; `POST /docgia` bỏ qua `trangThai`; gia hạn của người khác trả 422.

## 5. Bản phân tích mới nhất

### DB v2.2 (đóng băng)
15 bảng, 9 view, 9 function, 30 procedure, 12 trigger, 3 event; `10_regression_test.sql` 157/157 PASS (MySQL 8.0.46). Repo `database_info` đã push (`d48ee8a`, `30e82d8`). Chỉ sửa DB khi có test tái hiện lỗi (FAIL trước khi sửa) hoặc đề bắt buộc; đề xuất khác ghi vào mục Hạn chế của `docs/05`.

Giả định nghiệp vụ đã chốt: SV và GV dùng chung hạn mức (5 cuốn, 14 ngày, gia hạn 1 lần 7 ngày); không quản lý hạn thẻ; không ghi cán bộ nhận trả/thu phạt; không trừ ngày lễ, không thanh toán phạt từng phần; được đặt trước đầu sách chưa có bản.

Lỗi đã sửa ở DB: **#49** — khóa tài khoản thu hồi token, người chờ đặt trước chọn theo `fn_ly_do_khong_the_dat_truoc`, mã bản sách theo `^BS[0-9]{1,9}$`. **#50** — không đặt trước đầu sách đang mượn, người chờ không đủ điều kiện không chặn gia hạn, sửa seed `dat_truoc`.

### Đánh giá bộ DB so với đề IE103 (sơ bộ)
- Mô tả bài toán và cài đặt: Đạt tốt. Phân tích thiết kế: Đạt — ERD chưa có thuộc tính, mô hình logic thiếu PK/FK/kiểu dữ liệu.
- Xử lý thông tin: Đạt tốt (cursor `sp_cursor_thong_ke_muon_theo_nguoi_dung` thực chất chỉ là GROUP BY).
- Report: Đạt — khoảng 4/9 view là thống kê thật, chưa có HAVING / window / NOT EXISTS, chưa có ảnh Tableau/PowerBI.
- Import/Export/Backup/Restore: đủ trong `ops/` nhưng báo cáo chỉ 1 dòng, không có CSV mẫu.
- `do_an_qltt_final.md` thiếu nặng: link video, ảnh kết quả, đoạn code minh họa; ước 9–11 trang trên giới hạn 20.

### Rủi ro / hạn chế đã biết (không sửa DB)
- Chưa giới hạn số lần đăng nhập sai (BE nên tự rate-limit `/auth/login`).
- SHA-256 có muối, chưa dùng KDF chậm (đã ghi đánh đổi vào docs).
- `vaiTro` trong JWT chưa đọc lại từ DB (chưa có endpoint đổi vai trò; nếu thêm thì phải đọc từ DB).
- Thủ thư vẫn thêm được người dùng loại CAN_BO (quyền cột MySQL không giới hạn theo dòng).
- `qltv_admin@'%'` có ALL; token/mật khẩu rõ trong general log.
- Mượn lại đúng bản vừa trả trong cùng phiếu lỗi 1062 (`uq_ctpm`); chưa giới hạn số lượt đặt.
- Tài liệu lệch code chưa sửa: `08_security.sql:24` cho thủ thư DELETE `sach_tac_gia`; chỗ ghi MySQL 9.7.1, chỗ ghi 8.0.

### Việc còn mở
1. Push nhánh `trongminh` — **hỏi người dùng trước**, không tự push.
2. Demo bảo mật tầng CSDL bằng DBeaver (`sql/11_demo_bao_mat.sql`): cần chạy `08b_create_users.sql` trên `mysql_container`, người dùng tự đặt 3 mật khẩu ≥ 12 ký tự với `@user_host='%'`. Không commit mật khẩu thật.
3. Thiếu theo đề: ảnh báo cáo Tableau/PowerBI (hoặc HTML đọc từ DB); hồ sơ nộp (`BaoCao_NhomX.pdf` 20–25 trang, `Slides_NhomX.pdf` 15–20, `Video_NhomX.txt`, `Source.zip`); kiểm tra hai file docx trong `huong_dan/` có khớp mục 4.2 mới và ERD đã có hình chưa.
4. Quy định đề: Note_2026 chỉ cho dùng AI ở phần website demo; báo cáo, slide và câu SQL không được dùng AI; báo cáo bị Turnitin, trùng > 25% là 0 điểm.

## 6. Lưu ý vận hành
- **Quy tắc BE (`CLAUDE.md`):** không tự commit/push; không thêm `Co-Authored-By` hay AI attribution; tên nhánh = tên tác giả. Đã kiểm tra: không commit nào trên `main..HEAD` còn dòng `Co-Authored-By`. Commit `f566f4b` (Sync DB v2.2) từng có dòng này và đã được viết lại ngày 2026-10-07 (rebase, cây file giữ nguyên); vì vậy mã các commit từ đó trở đi khác với mã cũ trong các ghi chú trước đây.
- **Đường dẫn NFD:** thư mục dự án có dấu tiếng Việt dạng NFD làm plugin Swagger của Nest sinh import sai, nên `nest start` / `node dist/main` lỗi `ERR_MODULE_NOT_FOUND`. Build và chạy ở bản copy đường dẫn ASCII, hoặc dời dự án sang thư mục không dấu (người dùng quyết định). `dist/` hiện là bản build từ copy ASCII.
- **Kiểm thử không đụng DB làm việc:** dùng container tạm `docker run mysql:8.0` cổng 3307, mount `sql/99_full_setup.sql` + `docker/02_service_user.sql` vào `/docker-entrypoint-initdb.d`, cờ `--character-set-client-handshake=FALSE --event-scheduler=ON`, đợi log `port: 3306 MySQL Community`, rồi chạy `DATABASE_URL=… npx vitest run` và `npx vitest run --config ./vitest.config.e2e.ts`.
- **Không chạy `npm run test:e2e` trên `mysql_container`** (cổng 3306, DB làm việc): test ghi thật (thêm người dùng, phiếu, nhật ký). Đã từng chạy nhầm và phải khôi phục từ mysqldump.
- **Bẫy test SQL:** so sánh chuỗi trong procedure test lỗi 1267 (collation `0900_ai_ci` với `utf8mb4_unicode_ci`); `INSERT … SELECT` từ `ban_sach` vào `ct_phieu_muon` lỗi 1442 vì trigger; chạy lại `04` làm mất EXECUTE nên phải chạy lại `08` và `08b`; user `@'localhost'` bị 1045 qua cổng container (cần `@user_host='%'`).
- **zsh:** `echo "=====X"` lỗi expansion, dùng `echo "--- X"`.
- Repo có cả `package-lock.json` (đã đổi ở `ff23abd`) lẫn `yarn.lock` (`5538dd7`) — nên chọn một trình quản lý gói.

## 7. Danh sách file thay đổi
Xem bằng lệnh:

```bash
git diff --name-status main
git diff --stat main
```

Nhóm chính: `src/` (~70 file mới: auth, ban-doc, bao-cao, danh-muc, dat-truoc, demo, docgia, muon-tra, phat, sach, common), `sql/` (11 file + `99_full_setup.sql`), `test/` (5 e2e), `docs/` (3 file), `prisma/schema.prisma`, `docker/`, `docker-compose.yml`.

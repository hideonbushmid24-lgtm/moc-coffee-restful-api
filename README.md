# ☕ Mộc Coffee – Hệ thống quản lý & đặt món cho quán cà phê

Đồ án môn **Lập trình Web & Ứng dụng (503073)** – đề tài **Restful Web Services**. Khách xem menu, gọi món, thanh toán, đặt bàn; quản lý đăng nhập trang admin để xử lý đơn, hóa đơn, bàn, đặt bàn và sản phẩm. Toàn bộ giao tiếp frontend ↔ backend đi qua 26 endpoint REST (JSON), xác thực bằng JWT.

## Thành viên & phân công

| Thành viên | Mã số SV | Phụ trách code | Phụ trách báo cáo (Chương) |
|---|---|---|---|
| **Khôi** (@tuitenkhoi) | 52400206 | Backend & Database – Auth JWT, Bàn / Đặt bàn / Dashboard | Chương 1–2: tổng quan, cơ sở lý thuyết REST, bảo mật API, so sánh REST–GraphQL–SOAP, tài liệu tham khảo |
| **Quang** | 52400229 | Không phụ trách module code riêng (tập trung phân tích – thiết kế) | Chương 3–4: yêu cầu (chức năng, phi chức năng, quy tắc nghiệp vụ, use case), kiến trúc, ERD, thiết kế API, sequence diagram |
| **Đức** | 52400109 | Backend & Frontend – Sản phẩm, Đơn hàng, Hóa đơn | Chương 5–6: cài đặt, kiểm thử, đánh giá kết quả, kết luận + format toàn bộ báo cáo và README |

Mọi thắc mắc về lý thuyết → hỏi Khôi; về API / kiến trúc → hỏi Quang; về kiểm thử & hoàn thiện báo cáo → hỏi Đức.

## Công nghệ
Node.js 18+ · Express 5 · MySQL/MariaDB (XAMPP) · JWT + bcrypt · Multer (upload ảnh) · HTML/CSS/JS thuần + Bootstrap 5

## Báo cáo giữa kỳ

Đề tài **Restful Web Services** – hạn nộp **07/11/2026**. Báo cáo viết bằng tiếng Việt, dựng trên `report/Template_VN.dotx` của khoa.

| File | Nội dung |
|---|---|
| `report/report.docx` | Bản nộp chính (đã cập nhật mục lục, danh sách hình/bảng và số trang trong Word) |
| `report/BaoCao_GiuaKy_503073_RestfulWebServices.docx` | Bản gốc xuất từ template, dùng để dựng lại khi cần chỉnh |
| `report/503073-Midterm.pdf` | Đề bài và bảng tiêu chí chấm |
| `report/Template_VN.dotx` | Template của khoa |

Cấu trúc sáu chương (mỗi chương khớp với phân công ở trên):

1. **Mở đầu & tổng quan đề tài** – lý do chọn, mục tiêu, tổng quan Mộc Coffee, cấu trúc báo cáo.
2. **Cơ sở lý thuyết về RESTful Web Services** – 6 ràng buộc của Fielding, resource/representation/URI, HTTP methods ↔ CRUD, mã trạng thái, JWT so với OAuth 2.0 / API Key, thực hành tốt, bảng so sánh REST – GraphQL – SOAP.
3. **Phân tích yêu cầu** – 2 tác nhân, 19 yêu cầu chức năng, 9 quy tắc nghiệp vụ, 11 yêu cầu phi chức năng, use case + 3 đặc tả.
4. **Thiết kế hệ thống & kiến trúc RESTful API** – kiến trúc 3 lớp, ERD, danh mục 26 endpoint, format phản hồi, lọc/tìm kiếm/sắp xếp/phân trang, thiết kế bảo mật, Multer, giao dịch, sequence & state diagram.
5. **Cài đặt, kiểm thử & đánh giá** – môi trường, 13/13 ca kiểm thử tự động, 17 ca kiểm thử API bằng curl, đối chiếu màn hình ↔ API, ảnh chụp giao diện khách & admin, ma trận xác thực/phân quyền, kết quả 31 hạng mục thủ công.
6. **Kết luận & hướng phát triển** + Tài liệu tham khảo.

Số liệu để đối chiếu nhanh giữa báo cáo và mã nguồn: **26 endpoint**, **34 bảng**, **22 hình**. Khi mở bằng bản gốc chưa cập nhật field, trong Word nhấn **Ctrl + A rồi F9** (hoặc chọn cập nhật khi được hỏi) để sinh mục lục và danh sách hình/bảng.

## Cài đặt và chạy

**1. Lấy mã nguồn và cài thư viện**
```bash
git clone https://github.com/tuitenkhoi/web-programming-project.git
cd web-programming-project
npm install
```

**2. Tạo cơ sở dữ liệu** (bật MySQL trong XAMPP trước). Luôn nhập bằng `utf8mb4` để không lỗi tiếng Việt:
```bash
mysql --default-character-set=utf8mb4 -u root -p < database/schema.sql
```
> Nếu đã có DB từ bản cũ, chạy thêm theo thứ tự: `database/migrations/001_bookings_to_standard.sql`, rồi `database/migrations/002_add_indexes.sql`.

**3. Tạo file cấu hình**
```bash
cp .env.example .env      # Windows: copy .env.example .env
```
Mở `.env`, điền `DB_PASSWORD` (XAMPP mặc định để trống) và `JWT_SECRET` (chuỗi ngẫu nhiên **ít nhất 32 ký tự**, thiếu thì server không khởi động). Sinh nhanh:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**4. Tạo tài khoản admin**
```bash
npm run create-admin -- admin@moccoffee.local admin12345678 "Quản lý"
```

**5. Chạy**
```bash
npm start          # hoặc: npm run dev  (tự khởi động lại khi sửa code)
```
Mở http://localhost:5000 (khách) và http://localhost:5000/admin/login.html (quản lý).

## Kiểm tra nhanh
```bash
npm run verify          # kiểm tra mã nguồn + toàn bộ test
npm run test:coverage   # chạy test và in báo cáo coverage
```
Bộ kiểm thử tự động dùng Node test runner (không cần MySQL, kết nối CSDL được thay bằng bản giả). Ngoài 13 ca chức năng trong báo cáo, dự án có thêm các ca bảo mật cho JWT, phân quyền theo database, JSON hỏng và lỗi 404 API. `npm run check` còn phát hiện lỗi cú pháp JavaScript, marker xung đột Git và `id` HTML bị trùng.

Mỗi push/pull request vào `main` cũng tự chạy các bước trên bằng GitHub Actions (`.github/workflows/ci.yml`). Kiểm tra database thật có đúng cấu trúc bằng `npm run check-db`. Danh sách kiểm thử thủ công: `docs/KIEM_THU_THU_CONG.md`; kịch bản trình bày: `docs/CHECKLIST_DEMO.md`.

## Xử lý lỗi thường gặp
**Trang admin báo "Lỗi máy chủ", "Lỗi truy vấn cơ sở dữ liệu", "Không thể lấy danh sách đặt bàn"...**
Thường do database đang dùng là bản cũ, thiếu bảng hoặc cột so với `database/schema.sql`. Server cũng in cảnh báo này ngay khi khởi động. Cách xử lý:
```bash
npm run check-db                 # liệt kê bảng/cột còn thiếu
mysql --default-character-set=utf8mb4 -u root -p < database/schema.sql   # tạo bảng còn thiếu (không xóa dữ liệu)
npm run check-db -- --fix        # tự thêm các cột còn thiếu vào bảng cũ
npm run check-db                 # phải báo "OK"
```
Sau đó khởi động lại server. Các lỗi khác: sai mật khẩu MySQL hoặc chưa bật MySQL cũng hiện thông báo riêng, xem lại file `.env` và XAMPP.

## Biến môi trường (`.env`)
| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `PORT` | không | Cổng chạy server (mặc định 5000) |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | không | Kết nối MySQL (mặc định theo XAMPP) |
| `JWT_SECRET` | **có** | Khóa ký token, ≥ 32 ký tự |
| `JWT_EXPIRES_IN` | không | Thời hạn đăng nhập (mặc định `8h`) |
| `CORS_ORIGIN` | không | Domain được gọi API, cách nhau bằng dấu phẩy. Bỏ trống = cho tất cả |
| `TRUST_PROXY` | không | Đặt `1` khi chạy sau Nginx/hosting để lấy đúng IP khách |
| `DB_POOL_SIZE` | không | Số kết nối MySQL tối đa (mặc định 10) |
| `AUTH_CACHE_MS` | không | Thời gian nhớ kết quả kiểm tra tài khoản admin, `0` = tắt (mặc định 10000) |

## Danh sách API
Ký hiệu: 🌐 công khai · 🔒 cần token admin (`Authorization: Bearer <token>`). Bảng dưới gom theo nhóm; tách đầy đủ theo từng route (đánh số 1–26, kèm mã trạng thái) xem **Bảng 4.5** trong báo cáo.

| Nhóm | Phương thức & đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| Hệ thống | `GET /api/health` | 🌐 | Kiểm tra server và DB |
| Đăng nhập | `POST /api/auth/login` | 🌐 | Đăng nhập admin, trả token |
| | `GET /api/admin/me` | 🔒 | Thông tin admin đang đăng nhập |
| Danh mục | `GET /api/categories` · `GET /api/categories/:id` | 🌐 | Danh mục đang bán và chi tiết một danh mục |
| | `GET /api/categories/admin` · `POST` · `PUT /:id` · `DELETE /:id` | 🔒 | Quản lý danh mục |
| Sản phẩm | `GET /api/products` · `GET /api/products/:id` | 🌐 | Menu (lọc `?search=` `?category_id=`) |
| | `GET /api/products/admin` · `POST` · `PUT /:id` · `DELETE /:id` | 🔒 | Quản lý sản phẩm, upload ảnh trường `image` (JPG/PNG/WEBP ≤ 5 MB) |
| Đơn hàng | `POST /api/orders` | 🌐 | Khách gọi món |
| | `GET /api/orders` | 🔒 | Danh sách có lọc + phân trang (xem bên dưới) |
| | `GET /api/orders/:id` · `PATCH /:id/status` · `PATCH /:id/payment` | 🔒 | Chi tiết, đổi trạng thái, xác nhận thanh toán |
| Bàn | `GET /api/tables` | 🌐 | Danh sách bàn và trạng thái |
| | `PATCH /api/tables/:id/status` | 🔒 | Đổi trạng thái bàn |
| Đặt bàn | `POST /api/bookings` | 🌐 | Khách đặt bàn |
| | `GET /api/bookings` · `PATCH /api/bookings/:id/status` | 🔒 | Danh sách, duyệt / hủy / xếp khách / hoàn tất |
| Tổng quan | `GET /api/dashboard/stats` | 🔒 | Số liệu dashboard |

**Tham số của `GET /api/orders`:** `page`, `limit` (mặc định 20, tối đa 200), `sort` (`newest` `oldest` `amount_desc` `amount_asc`), `q` (tìm theo mã đơn / tên / SĐT / bàn / mã hóa đơn `HD0012`), `status` (một hoặc nhiều, cách nhau dấu phẩy), `awaiting_payment=1`, `payment_status`, `payment_method`, `order_type`, `invoice_status`, `date`, `date_from`, `date_to`. Kết quả gồm `total`, `total_pages` và `summary` (số liệu tính trên tất cả đơn).

## Cấu trúc thư mục
```
server.js            Khởi động Express, gắn middleware và các router
config/db.js         Kết nối MySQL (pool dùng chung)
middleware/          auth.js (JWT + phân quyền), rateLimit.js (chống spam)
routes/              auth, bookings, tables, dashboard
backend/src/         controllers + routes + upload cho sản phẩm, danh mục, đơn hàng
backend/uploads/     Ảnh sản phẩm do admin tải lên (không đưa lên git)
database/            schema.sql và các file migrations
scripts/             create-admin.js và check-db.js
tests/               Kiểm tra tự động chức năng và bảo mật (Node test runner)
docs/                Tài liệu, bảng kiểm thử thủ công và checklist demo
.github/workflows/   CI tự kiểm tra code, test và coverage trên GitHub
report/              Báo cáo giữa kỳ 503073 – Restful Web Services (Word + template + đề bài)
index.html, pages/   Giao diện khách
admin/               Giao diện quản lý
assets/              CSS, JS, hình ảnh
```

## Lưu ý bảo mật khi triển khai
* Không commit `.env`; đặt `JWT_SECRET` dài và ngẫu nhiên.
* Xóa hoặc đổi mật khẩu mọi tài khoản mẫu/demo trong bảng `users` trước khi công khai.
* Chạy sau HTTPS và đặt `TRUST_PROXY=1` nếu có reverse proxy.

## Đầu ra khi nộp (hạn 07/11/2026)
* Báo cáo Word + PDF theo template khoa, 20–60 trang (không tính cover và appendix), đủ hình – bảng – sơ đồ: `report/report.docx`.
* Source code kèm README này (setup, `.env`, tạo admin, chạy test, danh sách API).
* Video demo tối đa 20 phút, cả ba thành viên cùng xuất hiện; mỗi người trình bày đúng phần được giao ở bảng phân công đầu README (Khôi: Chương 1–2, Quang: Chương 3–4, Đức: Chương 5–6).
* Tiêu chí chấm cần lưu ý: Theoretical Understanding (2đ) và Report Structure & Presentation (2đ) nằm ở Chương 2 và Chương 5–6; Comparative Analysis (1đ) ở bảng so sánh REST – GraphQL – SOAP; Application & Implementation (1đ) ở Chương 4–5.
* Sau khi báo cáo xong: làm slide và quay video demo.

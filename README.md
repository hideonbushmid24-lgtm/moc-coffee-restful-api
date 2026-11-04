# ☕ Mộc Coffee – Hệ thống quản lý & đặt món cho quán cà phê

Đồ án Lập trình Web & Ứng dụng. Khách xem menu, gọi món, thanh toán, đặt bàn; quản lý đăng nhập trang admin để xử lý đơn, hóa đơn, bàn, đặt bàn và sản phẩm.

## Thành viên
* **Khôi (@tuitenkhoi)** – Backend & Database (Auth JWT, Bàn / Đặt bàn / Dashboard)
* **Đức** – Backend & Frontend (Sản phẩm, Đơn hàng, Hóa đơn)

## Công nghệ
Node.js 18+ · Express 5 · MySQL/MariaDB (XAMPP) · JWT + bcrypt · Multer (upload ảnh) · HTML/CSS/JS thuần + Bootstrap 5

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
npm run create-admin -- admin@moccoffee.vn "MatKhauManh123" "Quản lý"
```

**5. Chạy**
```bash
npm start          # hoặc: npm run dev  (tự khởi động lại khi sửa code)
```
Mở http://localhost:5000 (khách) và http://localhost:5000/admin/login.html (quản lý).

## Kiểm tra nhanh
```bash
npm test
```
Chạy các bài kiểm tra tự động cho API chính (không cần MySQL). Kiểm tra database của bạn có đúng cấu trúc không: `npm run check-db`. Danh sách kiểm tra thủ công để nộp: `docs/KIEM_THU_THU_CONG.md`.

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
Ký hiệu: 🌐 công khai · 🔒 cần token admin (`Authorization: Bearer <token>`)

| Nhóm | Phương thức & đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| Hệ thống | `GET /api/health` | 🌐 | Kiểm tra server và DB |
| Đăng nhập | `POST /api/auth/login` | 🌐 | Đăng nhập admin, trả token |
| | `GET /api/admin/me` | 🔒 | Thông tin admin đang đăng nhập |
| Danh mục | `GET /api/categories` | 🌐 | Danh mục đang bán |
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
scripts/             create-admin.js
tests/               Kiểm tra tự động (npm test)
docs/                Tài liệu, bảng kiểm thử thủ công
index.html, pages/   Giao diện khách
admin/               Giao diện quản lý
assets/              CSS, JS, hình ảnh
```

## Lưu ý bảo mật khi triển khai
* Không commit `.env`; đặt `JWT_SECRET` dài và ngẫu nhiên.
* Xóa hoặc đổi mật khẩu mọi tài khoản mẫu/demo trong bảng `users` trước khi công khai.
* Chạy sau HTTPS và đặt `TRUST_PROXY=1` nếu có reverse proxy.

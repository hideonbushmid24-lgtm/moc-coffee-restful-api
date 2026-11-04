-- Thêm index cho các truy vấn hay dùng. Chạy MỘT LẦN trên DB hiện có:
--   mysql -u root -p moc_coffee < database/migrations/002_add_indexes.sql
-- (Nếu báo "Duplicate key name" nghĩa là index đó đã có, bỏ qua dòng đó.)
USE moc_coffee;

-- Kiểm tra "bàn còn đơn chưa xong không" (tables.js, bookings.js: WHERE table_code = ? ... FOR UPDATE).
-- Trước đây không có index nên MySQL quét và KHÓA nhiều dòng của bảng orders.
CREATE INDEX idx_orders_table_open ON orders (table_code, status, payment_status);

-- Thẻ thống kê và lọc theo trạng thái thanh toán ở trang admin
CREATE INDEX idx_orders_payment_status ON orders (payment_status);

-- Kiểm tra trùng lịch đặt bàn: WHERE table_id = ? AND status IN (...) AND booking_date BETWEEN ...
CREATE INDEX idx_bookings_table_date_time ON bookings (table_id, booking_date, booking_time);

-- Danh sách booking admin: lọc theo status, sắp theo created_at
CREATE INDEX idx_bookings_status_created ON bookings (status, created_at);

-- Danh sách món cho khách: WHERE status = 1 AND category_id = ?
CREATE INDEX idx_products_status_category ON products (status, category_id);

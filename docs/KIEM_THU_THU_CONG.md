# Bảng kiểm thử thủ công – Mộc Coffee

Điền cột **Kết quả** (Đạt / Lỗi) và **Ghi chú** khi thử. Chạy `npm start` và mở http://localhost:5000.

Ngày kiểm thử: ........../........../..........    Người kiểm thử: ..............................

| # | Chức năng | Bước thực hiện | Kết quả mong đợi | Kết quả | Ghi chú |
|---|---|---|---|---|---|
| 1 | Đăng nhập admin | Vào `/admin/login.html`, nhập đúng email và mật khẩu | Vào được dashboard | | |
| 2 | Đăng nhập sai | Nhập sai mật khẩu | Báo "Email hoặc mật khẩu không chính xác", không vào được | | |
| 3 | Chặn khi chưa đăng nhập | Mở `/admin/orders.html` khi chưa đăng nhập | Bị chuyển về trang đăng nhập | | |
| 4 | Khóa đăng nhập sai nhiều lần | Nhập sai mật khẩu 10 lần liên tiếp | Báo thử lại sau 15 phút | | |
| 5 | Xem menu | Mở `/pages/menu.html` | Hiện đủ món, ảnh, giá; lọc theo danh mục và tìm kiếm đúng | | |
| 6 | Chi tiết món | Bấm vào một món | Hiện đúng thông tin, chọn size/đường/đá/topping | | |
| 7 | Thêm vào giỏ | Thêm 2 món vào giỏ | Số trên biểu tượng giỏ tăng, giỏ hiện đúng món và tổng tiền | | |
| 8 | Gọi món tại bàn | Giỏ → chọn "Tại bàn" + mã bàn → đặt | Tạo đơn, hiện trang thành công | | |
| 9 | Gọi món mang đi | Giỏ → chọn "Mang đi" → đặt | Tạo đơn, không tính phí phục vụ | | |
| 10 | Mã giảm giá | Nhập `MOCCOFFEE10` | Giảm 10% | | |
| 11 | Thanh toán tiền mặt | Chọn tiền mặt | Đơn ở trạng thái "Chưa thanh toán" | | |
| 12 | Thanh toán chuyển khoản | Chọn chuyển khoản | Hiện mã QR, đơn "Chờ xác nhận chuyển khoản" | | |
| 13 | Admin xem đơn | `/admin/orders.html` | Thấy đơn vừa tạo, đúng món và số tiền | | |
| 14 | Phân trang đơn | Có hơn 20 đơn, bấm "Sau" / số trang | Chuyển trang đúng, dòng "Hiển thị x–y trong tổng số" đúng | | |
| 15 | Lọc và tìm đơn | Lọc theo tab, ngày, loại; gõ tên khách | Kết quả đúng, về trang 1 | | |
| 16 | Xử lý đơn | Xác nhận → chế biến → sẵn sàng | Trạng thái đổi theo từng bước | | |
| 17 | Hoàn thành khi chưa thanh toán | Bấm "Hoàn thành" khi chưa xác nhận thanh toán | Báo cần xác nhận thanh toán trước | | |
| 18 | Xác nhận thanh toán | Bấm "Đã thanh toán" | Trạng thái thành "Đã thanh toán"; bấm lần 2 báo đã thanh toán | | |
| 19 | Hóa đơn | `/admin/invoices.html` | Mã `HD0001...`, chi tiết đúng; thẻ thống kê và doanh thu hôm nay đúng | | |
| 20 | In hóa đơn | Mở chi tiết hóa đơn → In | Bản in gọn, đủ thông tin | | |
| 21 | Đặt bàn | `/pages/booking.html`: chọn ngày giờ, số khách, bàn → gửi | Tạo booking "chờ xác nhận", có mã đặt bàn | | |
| 22 | Danh sách bàn lấy từ API | Admin chuyển 1 bàn sang "bảo trì" → tải lại trang đặt bàn | Bàn đó hiện "Đang bảo trì" và không chọn được | | |
| 23 | Trùng lịch đặt bàn | Đặt cùng bàn, trong vòng 120 phút | Báo bàn đã có lịch trùng | | |
| 24 | Quá sức chứa | Chọn số khách lớn hơn sức chứa bàn | Bàn bị khóa / báo vượt sức chứa | | |
| 25 | Admin duyệt đặt bàn | `/admin/bookings.html`: xác nhận → xếp khách → hoàn tất | Trạng thái booking và bàn đổi đúng | | |
| 26 | Quản lý bàn | `/admin/tables.html` đổi trạng thái | Cập nhật đúng; bàn đang có booking/đơn mở thì bị chặn | | |
| 27 | Thêm sản phẩm | `/admin/products.html`: thêm món có ảnh JPG | Thêm được, ảnh hiện ở menu | | |
| 28 | Upload sai định dạng | Chọn file `.txt` hoặc file ảnh giả đổi đuôi | Bị từ chối | | |
| 29 | Sửa / xóa sản phẩm | Sửa giá, xóa món | Cập nhật đúng, ảnh cũ bị xóa | | |
| 30 | Phân quyền | Gọi `GET /api/orders` không có token | Trả 401 | | |
| 31 | Responsive | Mở trang khách bằng điện thoại hoặc DevTools (≤ 576px) | Không vỡ giao diện, cuộn ngang không xuất hiện | | |

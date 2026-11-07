# Checklist demo Mộc Coffee

Tài liệu này giúp nhóm demo theo một luồng thống nhất, tránh bỏ sót chức năng hoặc dùng nhầm dữ liệu cũ.

## 1. Chuẩn bị trước khi trình bày

```bash
npm ci
npm run verify
npm run check-db
npm start
```

- Xác nhận MySQL đang chạy và terminal không có lỗi kết nối.
- Mở cửa sổ ẩn danh cho giao diện khách và một cửa sổ thường cho admin.
- Mở DevTools ở cả hai cửa sổ; Console phải sạch.
- Không dùng tài khoản/mật khẩu thật trong slide hoặc video.

## 2. Luồng khách hàng

1. Mở trang chủ, kiểm tra sản phẩm được tải từ API.
2. Tìm kiếm/lọc món, mở chi tiết và thêm món vào giỏ.
3. Cập nhật số lượng, kiểm tra tổng tiền thay đổi.
4. Chọn bàn còn trống, điền thông tin và tạo đơn.
5. Kiểm tra trang thành công hiển thị đúng mã đơn.
6. Tạo một booking ở bàn còn trống và ghi lại mã booking.

Kết quả mong đợi: dữ liệu vừa tạo xuất hiện trong MySQL và trang admin, không cần sửa database thủ công.

## 3. Luồng quản trị

1. Đăng nhập admin và mở Dashboard.
2. Đối chiếu doanh thu, số đơn và trạng thái 8 bàn với database.
3. Mở đơn vừa tạo, chuyển lần lượt: xác nhận → chế biến → sẵn sàng → hoàn thành.
4. Xác nhận thanh toán và mở/in hóa đơn.
5. Kiểm tra bàn của đơn trở lại `available` khi không còn đơn mở.
6. Duyệt booking, xếp khách và hoàn tất; đối chiếu trạng thái bàn.
7. Thêm một món có ảnh, sửa món, tìm kiếm rồi chuyển trạng thái hoặc xóa món thử nghiệm.

## 4. Bảo mật và chất lượng

- Gọi API admin không có token phải nhận `401`.
- Token customer gọi API admin phải nhận `403`.
- Dữ liệu form sai phải nhận `400`, không tạo bản ghi rác.
- Truy cập `/.env`, `/server.js`, `/config/db.js` phải bị chặn.
- Thu nhỏ trình duyệt về kích thước mobile/tablet và kiểm tra menu, bảng, modal không tràn ngang bất thường.

## 5. Sau demo

- Xóa dữ liệu thử nghiệm nếu không dùng cho báo cáo.
- Không commit `.env`, ảnh upload thử hoặc `node_modules`.
- Chụp lại kết quả `npm run verify` và GitHub Actions xanh để làm bằng chứng kiểm thử.

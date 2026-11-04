// Đổi lỗi MySQL thành câu tiếng Việt nói rõ nguyên nhân thường gặp,
// để trang admin hiện thông báo hữu ích thay vì chỉ "Lỗi máy chủ".
function dbErrorMessage(error, fallback) {
    switch (error && error.code) {
        case 'ER_NO_SUCH_TABLE':
        case 'ER_BAD_FIELD_ERROR':
            return 'Cấu trúc database chưa khớp với code. Chạy "npm run check-db" để xem cần sửa gì.';
        case 'ER_BAD_DB_ERROR':
            return 'Chưa có database. Hãy nhập database/schema.sql.';
        case 'ER_ACCESS_DENIED_ERROR':
            return 'Sai tài khoản hoặc mật khẩu MySQL trong file .env.';
        case 'ECONNREFUSED':
        case 'PROTOCOL_CONNECTION_LOST':
        case 'ETIMEDOUT':
            return 'Không kết nối được MySQL. Hãy bật MySQL (XAMPP) và kiểm tra file .env.';
        default:
            return fallback;
    }
}

module.exports = { dbErrorMessage };

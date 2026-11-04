const mysql = require('mysql2/promise');

// Kết nối Pool đến MySQL - DÙNG CHUNG cho toàn bộ dự án
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',      // Mặc định XAMPP là 'root'
    password: process.env.DB_PASSWORD || '',   // Mặc định XAMPP để trống
    database: process.env.DB_NAME || 'moc_coffee',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 100,           // quá 100 request đang chờ kết nối thì báo lỗi ngay, không để treo vô hạn
    connectTimeout: 10000,     // 10s không kết nối được MySQL thì báo lỗi
    enableKeepAlive: true,     // giữ kết nối sống, tránh lỗi "read ECONNRESET" sau khi để quên một lúc
    keepAliveInitialDelay: 10000,
    maxIdle: 10,               // số kết nối rảnh tối đa được giữ lại
    idleTimeout: 60000         // kết nối rảnh quá 60s thì đóng
});

module.exports = pool;
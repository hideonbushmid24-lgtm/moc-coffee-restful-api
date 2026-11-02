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
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
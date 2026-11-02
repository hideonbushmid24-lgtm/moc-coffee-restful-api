const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { SECRET_KEY } = require('../middleware/auth');

const router = express.Router();
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Giới hạn đăng nhập sai: tối đa 10 lần / 15 phút cho mỗi IP (lưu trong bộ nhớ)
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map();

const isBlocked = (ip) => {
    const rec = fails.get(ip);
    if (!rec) return false;
    if (Date.now() - rec.first > WINDOW_MS) { fails.delete(ip); return false; }
    return rec.count >= MAX_FAILS;
};
const recordFail = (ip) => {
    const rec = fails.get(ip);
    if (!rec || Date.now() - rec.first > WINDOW_MS) fails.set(ip, { count: 1, first: Date.now() });
    else rec.count++;
};

// Hash giả để thời gian phản hồi không lộ việc tài khoản có tồn tại hay không
const DUMMY_HASH = bcrypt.hashSync('khong-ton-tai', 10);

// POST /api/auth/login  { email, password }  (cột users.email của DB thật; không có cột username)
router.post('/login', async (req, res) => {
    const ip = req.ip;
    if (isBlocked(ip)) {
        return res.status(429).json({ message: 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút!' });
    }

    const body = req.body || {};
    const email = String(body.email || body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu!' });
    }

    try {
        const [rows] = await db.query(
            'SELECT id, email, full_name, password_hash, role, status FROM users WHERE email = ? LIMIT 1',
            [email]
        );
        const user = rows[0];

        // Hash tạo bởi PHP có tiền tố $2y$, bcryptjs đọc được khi đổi thành $2a$
        const hash = user ? String(user.password_hash).replace(/^\$2y\$/, '$2a$') : DUMMY_HASH;
        const passwordOk = await bcrypt.compare(password, hash);

        if (!user || !passwordOk || user.role !== 'admin' || Number(user.status) !== 1) {
            recordFail(ip);
            return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác!' });
        }

        fails.delete(ip);
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: EXPIRES_IN, algorithm: 'HS256' }
        );

                // Dạng phản hồi chung của toàn bộ API: { success, data }
        res.json({
            success: true,
            data: {
                token,
                expiresIn: EXPIRES_IN,
                user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
            }
        });
    } catch (err) {
        console.error('Lỗi đăng nhập:', err);
        res.status(500).json({ message: 'Lỗi máy chủ!' });
    }
});

module.exports = router;

require('dotenv').config(); // phải nạp .env trước khi require middleware/routes
const express = require('express');
const cors = require('cors');
const path = require('path');
const {
    verifyToken,
    requireAdmin,
} = require('./middleware/auth');
const categoryRoutes = require('./backend/src/routes/category.routes');
const productRoutes = require('./backend/src/routes/product.routes');
const orderRoutes = require('./backend/src/routes/order.routes');

const app = express();
app.use(cors());
app.use(express.json());

// Chỉ phục vụ các thư mục giao diện, KHÔNG phục vụ cả thư mục dự án (tránh lộ .env, server.js, config/).
// Sửa danh sách này cho khớp cấu trúc thư mục của bạn.
const STATIC_DIRS = ['admin', 'assets', 'pages'];

const PUBLIC_EXTENSIONS = new Set([
    '.html',
    '.css',
    '.js',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.avif',
    '.svg',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
]);

function allowPublicFile(req, res, next) {
    let decodedPath;

    try {
        decodedPath = decodeURIComponent(req.path);
    } catch {
        return res.status(400).end();
    }

    const segments = decodedPath.split('/');
    const extension = path.extname(decodedPath).toLowerCase();

    const blocked =
        decodedPath.includes('\\') ||
        decodedPath.includes('\0') ||
        segments.some((segment) => segment.startsWith('.')) ||
        !PUBLIC_EXTENSIONS.has(extension);

    if (blocked) {
        return res.status(404).end();
    }

    next();
}

STATIC_DIRS.forEach((dir) => {
    app.use(
        '/' + dir,
        allowPublicFile,
        express.static(path.join(__dirname, dir), {
            index: false,
            dotfiles: 'deny',
            redirect: false,
        })
    );
});

app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const UPLOAD_IMAGE_EXTENSIONS = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
]);

app.use(
    '/uploads/products',
    allowPublicFile,
    (req, res, next) => {
        let decodedPath;

        try {
            decodedPath = decodeURIComponent(req.path);
        } catch {
            return res.status(400).end();
        }

        const extension = path.extname(decodedPath).toLowerCase();

        if (!UPLOAD_IMAGE_EXTENSIONS.has(extension)) {
            return res.status(404).end();
        }

        res.setHeader('X-Content-Type-Options', 'nosniff');
        next();
    },
    express.static(
        path.join(__dirname, 'backend/uploads/products'),
        {
            index: false,
            dotfiles: 'deny',
            redirect: false,
        }
    )
);

// API
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Mộc Coffee API đang hoạt động',
    });
});

// Mỗi router tự lo GET công khai, còn thêm/sửa/xóa thì cần admin
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.get('/api/admin/me', verifyToken, requireAdmin, (req, res) => {
    res.json({
        success: true,
        data: req.user,
    });
});

app.use('/api/orders', orderRoutes);
app.use('/api/auth', require('./routes/auth'));
app.use(
    '/api/dashboard',
    verifyToken,
    requireAdmin,
    require('./routes/dashboard')
); // toàn bộ cần token
app.use('/api/tables', require('./routes/tables'));     // GET công khai, PATCH cần token (bên trong route)
app.use('/api/bookings', require('./routes/bookings')); // POST công khai, GET/PATCH cần token (bên trong route)

// 404
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'Không tìm thấy đường dẫn API!' });
    }
    res.status(404).send('Không tìm thấy trang!');
});

// Xử lý lỗi chung
app.use((err, req, res, next) => {
    // Lỗi upload ảnh (quá 5 MB, sai tên trường...)
    if (err.name === 'MulterError') {
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? 'Ảnh sản phẩm không được vượt quá 5 MB'
            : 'Lỗi upload: ' + err.message;
        return res.status(400).json({ success: false, message });
    }
    // Sai định dạng ảnh (do upload.middleware.js ném ra)
    if (err.message === 'Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP') {
        return res.status(400).json({ success: false, message: err.message });
    }

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Dữ liệu JSON không hợp lệ!' });
    }
    console.error('Lỗi không mong muốn:', err);
    res.status(500).json({ message: 'Lỗi máy chủ!' });
});

const PORT = Number(process.env.PORT || 5000);

if (require.main === module) {
    const server = app.listen(PORT);

    server.once('listening', () => {
        console.log(`Server đang chạy tại http://localhost:${PORT}`);
        console.log(`PID: ${process.pid}`);
        console.log(`Thư mục dự án: ${__dirname}`);
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`Không thể khởi động: cổng ${PORT} đang được sử dụng.`);
        } else {
            console.error('Lỗi khởi động server:', error.code || error.message);
        }

        process.exitCode = 1;
    });
}

module.exports = app;
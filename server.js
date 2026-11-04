require('dotenv').config(); // phải nạp .env trước khi require middleware/routes
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const db = require('./config/db');
const { inspectSchema } =require('./config/schemaCheck');
const rateLimit = require('./middleware/rateLimit');
const {
    verifyToken,
    requireAdmin,
} = require('./middleware/auth');
const categoryRoutes = require('./backend/src/routes/category.routes');
const productRoutes = require('./backend/src/routes/product.routes');
const orderRoutes = require('./backend/src/routes/order.routes');

const app = express();

app.disable('x-powered-by');

if (process.env.TRUST_PROXY) {
    app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
}

// CORS_ORIGIN="http://localhost:5500,https://moccoffee.vn" để chỉ cho các domain này gọi API.
// Bỏ trống = cho phép mọi domain(giữ hành vi cũ)

const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : undefined));

// Thêm các header bảo mật (X-Content-Type-Options, X-Frame-Options...).
// Tắt CSP vì giao diện đang nạp Bootstrap/icon từ CDN và có script inline; bật lại sau khi đã liệt kê đủ nguồn.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression()); // nén gzip HTML/CSS/JS/JSON, giảm đáng kể dung lượng tải
app.use(express.json({ limit: '100kb' }));

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

// Ảnh/font ít đổi -> cho trình duyệt cache 7 ngày. HTML/CSS/JS vẫn kiểm tra ETag mỗi lần
// (sửa code xong F5 là thấy ngay, không bị kẹt bản cũ).
const CACHEABLE_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.otf',
]);

function setStaticCacheHeaders(res, filePath) {
    if (CACHEABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
    }
}

STATIC_DIRS.forEach((dir) => {
    app.use(
        '/' + dir,
        allowPublicFile,
        express.static(path.join(__dirname, dir), {
            index: false,
            dotfiles: 'deny',
            redirect: false,
            setHeaders: setStaticCacheHeaders,
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
            immutable: true, // tên file upload là duy nhất (timestamp + random) nên không bao giờ đổi nội dung
            maxAge: '30d',
        }
    )
);

// API
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({
            success: true,
            message: 'Mộc Coffee API đang hoạt động',
        });
    } catch (error) {
        console.error('Health check lỗi DB:', error.code);
        res.status(503).json({
            success: false,
            message: 'Không kết nối được cơ sở dữ liệu',
        });
    }
 });

// Chống spam cho các API công khai (khách không cần đăng nhập).
// Khách trong quán dùng chung wifi = chung 1 IP nên giới hạn đơn hàng để rộng.
app.use('/api/orders', rateLimit({ windowMs: 10 * 60 * 1000, max: 100, methods: ['POST'] }));
app.use('/api/bookings', rateLimit({ windowMs: 10 * 60 * 1000, max: 30, methods: ['POST'] }));


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

    // Tắt server êm: ngừng nhận request mới, chờ request đang chạy xong rồi đóng pool MySQL
    const shutdown = (signal) => {
        console.log(`Nhận ${signal}, đang tắt server...`);
        server.close(async () => {
            try { await db.end(); } catch { /* bỏ qua */ }
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref(); // quá 10s thì tắt cứng
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('unhandledRejection', (reason) => console.error('unhandledRejection:', reason));

    server.once('listening', () => {
        console.log(`Server đang chạy tại http://localhost:${PORT}`);
        console.log(`PID: ${process.pid}`);
        console.log(`Thư mục dự án: ${__dirname}`);

        // Cảnh báo sớm nếu database cũ thiếu bảng/cột (nguyên nhân hay gặp của lỗi "Lỗi máy chủ")
        inspectSchema(db)
            .then(({ database, issues }) => {
                if (!issues.length) return;
                console.warn(`\n⚠ Database "${database}" chưa khớp với code (${issues.length} vấn đề):`);
                issues.forEach((issue) => console.warn('  - ' + issue.text));
                console.warn('  => Chạy "npm run check-db" để xem cách sửa.\n');
            })
            .catch((error) => {
                console.warn('Không kiểm tra được cấu trúc database:', error.code || error.message);
            });
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
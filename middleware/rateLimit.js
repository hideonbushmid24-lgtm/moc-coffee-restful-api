// Giới hạn số request theo IP, lưu trong bộ nhớ (đủ dùng cho 1 server Node duy nhất).
// Dùng cho các API công khai (đặt món, đặt bàn) để tránh bị spam làm đầy DB.
//   app.use('/api/orders', rateLimit({ windowMs: 60000, max: 20, methods: ['POST'] }));
function rateLimit({ windowMs = 60 * 1000, max = 30, methods = null, message } = {}) {
    const hits = new Map(); // ip -> { count, resetAt }

    // Dọn các IP đã hết hạn để Map không phình mãi (unref: không giữ tiến trình sống)
    setInterval(() => {
        const now = Date.now();
        for (const [ip, rec] of hits) {
            if (rec.resetAt <= now) hits.delete(ip);
        }
    }, windowMs).unref();

    return (req, res, next) => {
        if (methods && !methods.includes(req.method)) return next();

        const now = Date.now();
        let rec = hits.get(req.ip);

        if (!rec || rec.resetAt <= now) {
            rec = { count: 0, resetAt: now + windowMs };
            hits.set(req.ip, rec);
        }

        rec.count++;

        if (rec.count > max) {
            res.set('Retry-After', String(Math.ceil((rec.resetAt - now) / 1000)));
            return res.status(429).json({
                success: false,
                message: message || 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
            });
        }

        next();
    };
}

module.exports = rateLimit;

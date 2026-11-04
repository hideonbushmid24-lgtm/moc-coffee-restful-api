const express = require('express');
const router = express.Router();
const { randomBytes } = require('node:crypto');
const db = require('../config/db'); // kết nối CSDL
const {
    verifyToken,
    requireAdmin,
} = require('../middleware/auth');
const { dbErrorMessage } = require('../middleware/dbError');

const VALID_STATUS = ['pending', 'confirmed', 'cancelled'];
const BOOKING_FILTER_STATUS = [
    'pending',
    'confirmed',
    'seated',
    'completed',
    'cancelled',
];

const pad = (n) => String(n).padStart(2, '0');
const toMySqlDateTime = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// ===== Khách đặt bàn (công khai) =====
router.post('/', async (req, res) => {
    let connection;
    let transactionStarted = false;

    const reject = (status, message) => {
        const error = new Error(message);
        error.httpStatus = status;
        throw error;
    };

    const readText = (value, label, maxLength, required = false) => {
        if (value === undefined || value === null) value = '';

        if (typeof value !== 'string') {
            reject(400, label + ' phải là chuỗi ký tự.');
        }

        const text = value.trim();

        if ((required && !text) || text.length > maxLength) {
            reject(400, label + ' bị thiếu hoặc vượt độ dài cho phép.');
        }

        return text;
    };

    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
    const MINUTE_MS = 60 * 1000;
    const DAY_MS = 24 * 60 * MINUTE_MS;
    const SLOT_MS = 120 * MINUTE_MS;

    const vnDate = (milliseconds) =>
        new Date(milliseconds + VN_OFFSET_MS)
            .toISOString()
            .slice(0, 10);

    const vnSqlTime = (milliseconds) =>
        new Date(milliseconds + VN_OFFSET_MS)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ');

    try {
        const body = req.body;

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            reject(400, 'Dữ liệu đặt bàn phải là một đối tượng JSON.');
        }

        const customerName = readText(
            body.customer_name, 'Họ tên', 100, true
        );

        const customerPhone = readText(
            body.customer_phone, 'Số điện thoại', 20, true
        );

        const customerEmail = readText(
            body.customer_email, 'Email', 150
        );

        const bookingDate = readText(
            body.booking_date, 'Ngày đặt', 10, true
        );

        const rawTime = readText(
            body.booking_time, 'Giờ đặt', 8, true
        );

        const tableCode = readText(
            body.table_code, 'Mã bàn', 20, true
        ).toUpperCase();

        const note = readText(body.note, 'Ghi chú', 300);

        if (customerName.length < 2) {
            reject(400, 'Họ tên phải có ít nhất 2 ký tự.');
        }

        if (!/^0\d{9}$/.test(customerPhone)) {
            reject(
                400,
                'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'
            );
        }

        if (
            customerEmail &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
        ) {
            reject(400, 'Email không hợp lệ.');
        }

        if (!/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(tableCode)) {
            reject(400, 'Mã bàn không hợp lệ.');
        }

        const guestValue = body.guest_count;

        if (
            !['string', 'number'].includes(typeof guestValue) ||
            !/^[1-9]\d*$/.test(String(guestValue))
        ) {
            reject(400, 'Số khách phải là số nguyên dương.');
        }

        const guestCount = Number(guestValue);

        if (!Number.isSafeInteger(guestCount) || guestCount > 20) {
            reject(400, 'Số khách phải từ 1 đến 20.');
        }

        if (
            !/^20\d{2}-\d{2}-\d{2}$/.test(bookingDate) ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(rawTime)
        ) {
            reject(400, 'Ngày hoặc giờ đặt bàn không đúng định dạng.');
        }

        const bookingTime = rawTime.slice(0, 5);
        const localStart = bookingDate + 'T' + bookingTime + ':00';
        const startMs = Date.parse(localStart + '+07:00');

        if (
            !Number.isFinite(startMs) ||
            vnSqlTime(startMs) !== localStart.replace('T', ' ')
        ) {
            reject(400, 'Ngày đặt bàn không tồn tại.');
        }

        const now = Date.now();

        if (startMs < now + 30 * MINUTE_MS) {
            reject(400, 'Vui lòng đặt bàn trước ít nhất 30 phút.');
        }

        if (bookingDate > vnDate(now + 30 * DAY_MS)) {
            reject(400, 'Chỉ được đặt bàn trước tối đa 30 ngày.');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [tables] = await connection.execute(
            `SELECT id, table_code, table_name, capacity, area, status
             FROM coffee_tables
             WHERE table_code = ?
             FOR UPDATE`,
            [tableCode]
        );

        if (!tables.length) {
            reject(404, 'Bàn được chọn không tồn tại.');
        }

        const table = tables[0];

        if (!['available', 'occupied'].includes(table.status)) {
            reject(409, 'Bàn đang bảo trì hoặc không nhận đặt trước.');
        }

        if (guestCount > Number(table.capacity)) {
            reject(400, 'Số khách vượt quá sức chứa của bàn.');
        }

        if (startMs < Date.now() + 30 * MINUTE_MS) {
            reject(
                400,
                'Giờ đã chọn không còn đáp ứng thời gian đặt trước 30 phút.'
            );
        }

        const [conflicts] = await connection.execute(
            `SELECT id
             FROM bookings
             WHERE table_id = ?
               AND status IN ('pending', 'confirmed', 'seated')
               AND booking_date BETWEEN ? AND ?
               AND TIMESTAMP(booking_date, booking_time) < ?
               AND TIMESTAMP(booking_date, booking_time) > ?
             LIMIT 1
             FOR UPDATE`,
            [
                table.id,
                // Lọc thêm theo ngày để dùng index (table_id, booking_date, booking_time)
                // thay vì quét mọi booking của bàn.
                vnDate(startMs - SLOT_MS),
                vnDate(startMs + SLOT_MS),
                vnSqlTime(startMs + SLOT_MS),
                vnSqlTime(startMs - SLOT_MS),
            ]
        );

        if (conflicts.length) {
            reject(
                409,
                'Bàn đã có lịch đặt trùng trong khoảng 120 phút này.'
            );
        }

        const bookingCode =
            'BK' +
            bookingDate.replaceAll('-', '') +
            randomBytes(10).toString('hex').toUpperCase();

        const [result] = await connection.execute(
            `INSERT INTO bookings (
                booking_code,
                table_id,
                customer_name,
                customer_phone,
                customer_email,
                booking_date,
                booking_time,
                guest_count,
                note,
                status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                bookingCode,
                table.id,
                customerName,
                customerPhone,
                customerEmail || null,
                bookingDate,
                bookingTime + ':00',
                guestCount,
                note || null,
            ]
        );

        await connection.commit();
        transactionStarted = false;

        return res.status(201).json({
            success: true,
            message: 'Đã lưu yêu cầu đặt bàn. Vui lòng chờ xác nhận.',
            data: {
                id: result.insertId,
                booking_code: bookingCode,
                table_id: table.id,
                table_code: table.table_code,
                table_name: table.table_name,
                capacity: Number(table.capacity),
                area: table.area,
                booking_date: bookingDate,
                booking_time: bookingTime + ':00',
                booking_end: vnSqlTime(startMs + SLOT_MS),
                guest_count: guestCount,
                status: 'pending',
                duration_minutes: 120,
            },
        });
    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Lỗi rollback booking:',
                    rollbackError.code
                );
            }
        }

        if (error.httpStatus) {
            return res.status(error.httpStatus).json({
                success: false,
                message: error.message,
            });
        }

        console.error(
            'Lỗi tạo booking:',
            error.code || error.name
        );

        if (
            ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']
                .includes(error.code)
        ) {
            return res.status(503).json({
                success: false,
                message: 'Hệ thống đang bận. Vui lòng kiểm tra và thử lại sau.',
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Không thể hoàn tất yêu cầu. Hãy kiểm tra booking trước khi gửi lại.',
        });
    } finally {
        if (connection) connection.release();
    }
});

// ===== Danh sách đơn đặt bàn (admin) =====
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    const status = req.query.status;

    if (
        status !== undefined &&
        (
            typeof status !== 'string' ||
            !BOOKING_FILTER_STATUS.includes(status)
        )
    ) {
        return res.status(400).json({
            message: 'Trạng thái lọc không hợp lệ!',
        });
    }

    try {
        let sql = `
            SELECT
                b.id,
                b.booking_code,
                b.table_id,
                b.customer_name,
                b.customer_phone,
                b.customer_phone AS phone,
                b.customer_email,
                DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS booking_date,
                TIME_FORMAT(b.booking_time, '%H:%i:%s') AS booking_time,
                b.guest_count,
                b.guest_count AS number_of_guests,
                b.note,
                b.status,
                b.created_at,
                b.updated_at,
                t.table_code,
                t.table_name,
                t.capacity,
                t.area
            FROM bookings AS b
            INNER JOIN coffee_tables AS t
                ON t.id = b.table_id
        `;

        const params = [];

        if (status !== undefined) {
            sql += ' WHERE b.status = ?';
            params.push(status);
        }

        // Giới hạn số dòng trả về (mặc định 500, tối đa 1000) để danh sách không phình vô hạn theo thời gian.
        // Vẫn trả về mảng như cũ nên giao diện không phải sửa. Dùng ?limit= và ?offset= nếu cần xem thêm.
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 1000);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        sql += ' ORDER BY b.created_at DESC, b.id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        // dùng query (không phải execute) vì LIMIT ? OFFSET ? với prepared statement dễ lỗi ở một số bản MySQL
        const [bookings] = await db.query(sql, params);

        res.json(bookings);
    } catch (error) {
        console.error('Lỗi lấy danh sách booking:', error.code, error.sqlMessage || error.message);

        res.status(500).json({
            message: dbErrorMessage(error, 'Không thể lấy danh sách đặt bàn!'),
        });
    }
});


// ===== Duyệt / hủy đơn đặt bàn (admin) =====
router.patch('/:id/status', verifyToken, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const status = req.body?.status;

    const allowed = [
        'pending',
        'confirmed',
        'seated',
        'completed',
        'cancelled',
    ];

    if (
        !/^[1-9]\d*$/.test(req.params.id) ||
        !Number.isSafeInteger(id)
    ) {
        return res.status(400).json({
            success: false,
            message: 'Mã booking không hợp lệ.',
        });
    }

    if (typeof status !== 'string' || !allowed.includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Trạng thái không hợp lệ.',
        });
    }

    const transitions = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['seated', 'cancelled'],
        seated: ['completed'],
        completed: [],
        cancelled: [],
    };

    const fail = (httpStatus, message) => {
        const error = new Error(message);
        error.httpStatus = httpStatus;
        throw error;
    };

    const sqlVnTime = (milliseconds) =>
        new Date(milliseconds + 7 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ');

    let connection;
    let inTransaction = false;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        inTransaction = true;

        const [lookup] = await connection.execute(
            'SELECT table_id FROM bookings WHERE id = ?',
            [id]
        );

        if (!lookup.length) {
            fail(404, 'Không tìm thấy booking.');
        }

        const tableId = lookup[0].table_id;

        // Khóa bàn trước, cùng thứ tự với API tạo booking.
        const [tables] = await connection.execute(
            `SELECT id, table_code, status
             FROM coffee_tables
             WHERE id = ?
             FOR UPDATE`,
            [tableId]
        );

        if (!tables.length) {
            fail(409, 'Bàn của booking không còn tồn tại.');
        }

        const [bookings] = await connection.execute(
            `SELECT
                id,
                table_id,
                status,
                DATE_FORMAT(
                    TIMESTAMP(booking_date, booking_time),
                    '%Y-%m-%dT%H:%i:%s'
                ) AS starts_at
             FROM bookings
             WHERE id = ?
             FOR UPDATE`,
            [id]
        );

        if (!bookings.length) {
            fail(404, 'Không tìm thấy booking.');
        }

        const booking = bookings[0];
        const table = tables[0];

        if (String(booking.table_id) !== String(tableId)) {
            fail(
                409,
                'Bàn của booking vừa thay đổi. Hãy tải lại danh sách.'
            );
        }

        let tableStatus = table.status;
        const unchanged = booking.status === status;

        if (!unchanged) {
            if (!transitions[booking.status]?.includes(status)) {
                fail(
                    409,
                    'Không được chuyển từ ' +
                    booking.status + ' sang ' + status + '.'
                );
            }

            if (status === 'confirmed' || status === 'seated') {
                const startMs = Date.parse(
                    booking.starts_at + '+07:00'
                );

                const durationMs = 120 * 60 * 1000;
                const now = Date.now();

                if (!Number.isFinite(startMs)) {
                    fail(
                        409,
                        'Ngày giờ booking không hợp lệ. Cần kiểm tra dữ liệu.'
                    );
                }

                if (now >= startMs + durationMs) {
                    fail(
                        409,
                        'Lượt đặt bàn đã hết thời gian, không thể xác nhận hoặc nhận bàn.'
                    );
                }

                if (table.status === 'maintenance') {
                    fail(409, 'Bàn đang bảo trì.');
                }

                const [conflicts] = await connection.execute(
                    `SELECT id
                     FROM bookings
                     WHERE table_id = ?
                       AND id <> ?
                       AND status IN ('pending', 'confirmed', 'seated')
                       AND booking_date BETWEEN ? AND ?
                       AND TIMESTAMP(booking_date, booking_time) < ?
                       AND TIMESTAMP(booking_date, booking_time) > ?
                     LIMIT 1
                     FOR UPDATE`,
                    [
                        tableId,
                        id,
                        sqlVnTime(startMs - durationMs).slice(0, 10),
                        sqlVnTime(startMs + durationMs).slice(0, 10),
                        sqlVnTime(startMs + durationMs),
                        sqlVnTime(startMs - durationMs),
                    ]
                );

                if (conflicts.length) {
                    fail(
                        409,
                        'Booking bị trùng lịch với lượt đặt khác.'
                    );
                }

                if (status === 'seated') {
                    if (now < startMs) {
                        fail(
                            409,
                            'Chưa đến giờ nhận bàn của booking.'
                        );
                    }

                    if (table.status !== 'available') {
                        fail(
                            409,
                            'Bàn chưa trống, chưa thể xếp khách vào bàn.'
                        );
                    }

                    const [otherSeated] = await connection.execute(
                        `SELECT id
                         FROM bookings
                         WHERE table_id = ?
                           AND id <> ?
                           AND status = 'seated'
                         LIMIT 1
                         FOR UPDATE`,
                        [tableId, id]
                    );

                    if (otherSeated.length) {
                        fail(
                            409,
                            'Bàn còn booking khác đang phục vụ. Cần kiểm tra dữ liệu.'
                        );
                    }

                    tableStatus = 'occupied';
                }
            }

            if (status === 'completed') {
                if (table.status !== 'occupied') {
                    fail(
                        409,
                        'Trạng thái bàn không khớp booking đang phục vụ. Cần kiểm tra dữ liệu.'
                    );
                }

                const [otherSeated] = await connection.execute(
                    `SELECT id
                     FROM bookings
                     WHERE table_id = ?
                       AND id <> ?
                       AND status = 'seated'
                     LIMIT 1
                     FOR UPDATE`,
                    [tableId, id]
                );

                if (otherSeated.length) {
                    fail(
                        409,
                        'Bàn còn booking khác đang phục vụ.'
                    );
                }

                const [openOrders] = await connection.execute(
                    `SELECT id
                     FROM orders
                     WHERE table_code = ?
                       AND status <> 'cancelled'
                       AND (
                           status <> 'completed'
                           OR payment_status NOT IN ('paid', 'refunded')
                       )
                     LIMIT 1
                     FOR UPDATE`,
                    [table.table_code]
                );

                if (openOrders.length) {
                    fail(
                        409,
                        'Bàn còn đơn hàng chưa hoàn tất hoặc chưa xử lý thanh toán.'
                    );
                }

                tableStatus = 'available';
            }

            await connection.execute(
                'UPDATE bookings SET status = ? WHERE id = ?',
                [status, id]
            );

            if (tableStatus !== table.status) {
                await connection.execute(
                    'UPDATE coffee_tables SET status = ? WHERE id = ?',
                    [tableStatus, tableId]
                );
            }
        }

        await connection.commit();
        inTransaction = false;

        return res.json({
            success: true,
            message: unchanged
                ? 'Booking đã ở trạng thái này, không cập nhật lại.'
                : 'Cập nhật booking thành công.',
            data: {
                id,
                status,
                table_id: tableId,
                table_code: table.table_code,
                table_status: tableStatus,
                unchanged,
            },
            status,
            tableStatus,
        });
    } catch (error) {
        if (connection && inTransaction) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Lỗi rollback cập nhật booking:',
                    rollbackError.code
                );
            }
        }

        console.error(
            'Lỗi cập nhật booking:',
            error.code || error.httpStatus || error.name
        );

        return res.status(error.httpStatus || 500).json({
            success: false,
            message: error.httpStatus
                ? error.message
                : 'Không thể hoàn tất cập nhật. Hãy tải lại dữ liệu trước khi thử lại.',
        });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;

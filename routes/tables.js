const express = require('express');
const router = express.Router();
const db = require('../config/db');
const {
    verifyToken,
    requireAdmin,
} = require('../middleware/auth');
const { dbErrorMessage } = require('../middleware/dbError');

router.get('/', async (req, res) => {
    try {
        const [tables] = await db.query(
            `SELECT
                id,
                table_code,
                table_name,
                table_name AS name,
                capacity,
                area,
                status
             FROM coffee_tables
             ORDER BY id`
        );

        res.json(tables);
    } catch (error) {
        console.error('Lỗi lấy danh sách bàn:', error.code, error.sqlMessage || error.message);

        res.status(500).json({
            message: dbErrorMessage(error, 'Lỗi truy vấn cơ sở dữ liệu!'),
        });
    }
});

router.patch('/:id/status', verifyToken, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const status = req.body?.status;
    const allowed = ['available', 'occupied', 'maintenance'];

    if (
        !/^[1-9]\d*$/.test(req.params.id) ||
        !Number.isSafeInteger(id)
    ) {
        return res.status(400).json({
            success: false,
            message: 'Mã bàn không hợp lệ.',
        });
    }

    if (typeof status !== 'string' || !allowed.includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Chỉ chấp nhận available, occupied hoặc maintenance.',
        });
    }

    const transitions = {
        available: ['occupied', 'maintenance'],
        occupied: ['available'],
        maintenance: ['available'],
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

        const [tables] = await connection.execute(
            `SELECT id, table_code, status
             FROM coffee_tables
             WHERE id = ?
             FOR UPDATE`,
            [id]
        );

        if (!tables.length) {
            fail(404, 'Không tìm thấy bàn.');
        }

        const table = tables[0];
        const unchanged = table.status === status;

        if (!unchanged) {
            if (!transitions[table.status]?.includes(status)) {
                fail(
                    409,
                    'Không được chuyển trực tiếp từ ' +
                    table.status + ' sang ' + status + '.'
                );
            }

            const [seated] = await connection.execute(
                `SELECT id
                 FROM bookings
                 WHERE table_id = ?
                   AND status = 'seated'
                 LIMIT 1
                 FOR UPDATE`,
                [id]
            );

            if (seated.length) {
                fail(
                    409,
                    'Bàn có booking đang phục vụ. Hãy xử lý qua API booking.'
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

            const now = Date.now();
            const durationMs = 120 * 60 * 1000;

            if (status === 'occupied' || status === 'maintenance') {
                let sql = `
                    SELECT id
                    FROM bookings
                    WHERE table_id = ?
                      AND status IN ('pending', 'confirmed')
                      AND booking_date >= ?
                      AND TIMESTAMP(booking_date, booking_time) > ?
                `;

                const params = [
                    id,
                    sqlVnTime(now - durationMs).slice(0, 10), // lọc ngày trước để dùng index
                    sqlVnTime(now - durationMs),
                ];

                if (status === 'occupied') {
                    sql += `
                        AND TIMESTAMP(booking_date, booking_time) < ?
                    `;

                    params.push(sqlVnTime(now + durationMs));
                }

                sql += ' LIMIT 1 FOR UPDATE';

                const [reservations] = await connection.execute(
                    sql,
                    params
                );

                if (reservations.length) {
                    fail(
                        409,
                        status === 'occupied'
                            ? 'Bàn có lịch đặt chồng với 120 phút tới. Không nhận khách vãng lai bằng thao tác này.'
                            : 'Bàn còn lịch đặt chưa hết hạn. Cần xử lý các booking trước khi bảo trì.'
                    );
                }
            }

            await connection.execute(
                'UPDATE coffee_tables SET status = ? WHERE id = ?',
                [status, id]
            );
        }

        await connection.commit();
        inTransaction = false;

        res.json({
            success: true,
            message: unchanged
                ? 'Bàn đã ở trạng thái này, không cập nhật lại.'
                : 'Cập nhật trạng thái bàn thành công.',
            status,
            data: {
                id,
                table_code: table.table_code,
                status,
                unchanged,
            },
        });
    } catch (error) {
        if (connection && inTransaction) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Lỗi rollback trạng thái bàn:',
                    rollbackError.code
                );
            }
        }

        console.error(
            'Lỗi cập nhật bàn:',
            error.code || error.httpStatus || error.name
        );

        res.status(error.httpStatus || 500).json({
            success: false,
            message: error.httpStatus
                ? error.message
                : 'Không thể cập nhật bàn. Hãy tải lại dữ liệu trước khi thử lại.',
        });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { dbErrorMessage } = require('../middleware/dbError');

const PERIODS = {
    '7-days': {
        startCondition: 'CURDATE() - INTERVAL 6 DAY',
        groupFormat: '%Y-%m-%d',
    },
    '30-days': {
        startCondition: 'CURDATE() - INTERVAL 29 DAY',
        groupFormat: '%Y-%m-%d',
    },
    '12-months': {
        startCondition:
            "DATE_FORMAT(CURDATE() - INTERVAL 11 MONTH, '%Y-%m-01')",
        groupFormat: '%Y-%m',
    },
};

// GET /api/dashboard/stats?period=7-days
router.get('/stats', async (req, res) => {
    const period = String(req.query.period || '7-days');

    if (!Object.prototype.hasOwnProperty.call(PERIODS, period)) {
        return res.status(400).json({
            message: 'Khoảng thời gian thống kê không hợp lệ.',
        });
    }

    const periodConfig = PERIODS[period];

    try {
        const [
            [tableRows],
            [bookingRows],
            [orderRows],
            [revenueRows],
            [recentOrderRows],
            [upcomingBookingRows],
            [bestSellerRows],
        ] = await Promise.all([
            db.query(`
                SELECT
                    COUNT(*) AS total,
                    COALESCE(
                        SUM(status = 'occupied'),
                        0
                    ) AS occupied,
                    COALESCE(
                        SUM(status = 'maintenance'),
                        0
                    ) AS maintenance,
                    COALESCE(
                        SUM(
                            status = 'available'
                            AND has_reservation = 1
                        ),
                        0
                    ) AS reserved,
                    COALESCE(
                        SUM(
                            status = 'available'
                            AND has_reservation = 0
                        ),
                        0
                    ) AS available
                FROM (
                    SELECT
                        t.id,
                        t.status,
                        EXISTS (
                            SELECT 1
                            FROM bookings AS b
                            WHERE b.table_id = t.id
                              AND b.booking_date = CURDATE()
                              AND b.status = 'confirmed'
                        ) AS has_reservation
                    FROM coffee_tables AS t
                ) AS table_summary
            `),

            db.query(`
                SELECT
                    COALESCE(
                        SUM(
                            booking_date = CURDATE()
                            AND status <> 'cancelled'
                        ),
                        0
                    ) AS today_bookings,
                    COALESCE(
                        SUM(
                            booking_date = CURDATE()
                            AND status = 'pending'
                        ),
                        0
                    ) AS pending_today
                FROM bookings
            `),

            db.query(`
                SELECT
                    COUNT(*) AS total_orders,
                    COALESCE(
                        SUM(status = 'completed'),
                        0
                    ) AS completed_orders,
                    COALESCE(
                        SUM(
                            payment_status = 'paid'
                            AND status <> 'cancelled'
                            AND created_at >= CURDATE()
                            AND created_at < CURDATE() + INTERVAL 1 DAY
                        ),
                        0
                    ) AS paid_orders_today,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN payment_status = 'paid'
                                 AND status <> 'cancelled'
                                 AND created_at >= CURDATE()
                                 AND created_at < CURDATE() + INTERVAL 1 DAY
                                THEN total_amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS today_revenue,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN payment_status = 'paid'
                                 AND status <> 'cancelled'
                                 AND created_at >= CURDATE() - INTERVAL 1 DAY
                                 AND created_at < CURDATE()
                                THEN total_amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS yesterday_revenue,
                    DATE_FORMAT(
                        CURDATE(),
                        '%Y-%m-%d'
                    ) AS today_key
                FROM orders
            `),

            db.query(`
                SELECT
                    DATE_FORMAT(
                        created_at,
                        '${periodConfig.groupFormat}'
                    ) AS period_key,
                    COALESCE(
                        SUM(total_amount),
                        0
                    ) AS amount
                FROM orders
                WHERE payment_status = 'paid'
                  AND status <> 'cancelled'
                  AND created_at >= ${periodConfig.startCondition}
                  AND created_at < CURDATE() + INTERVAL 1 DAY
                GROUP BY period_key
                ORDER BY period_key
            `),

            db.query(`
                SELECT
                    order_code,
                    order_type,
                    table_code,
                    total_amount,
                    status,
                    payment_status,
                    created_at
                FROM orders
                ORDER BY created_at DESC, id DESC
                LIMIT 5
            `),

            db.query(`
                SELECT
                    b.booking_code,
                    b.customer_name,
                    b.booking_date,
                    b.booking_time,
                    b.guest_count,
                    b.status,
                    t.table_code,
                    t.area
                FROM bookings AS b
                INNER JOIN coffee_tables AS t
                    ON t.id = b.table_id
                WHERE b.status IN ('pending', 'confirmed')
                  AND TIMESTAMP(
                        b.booking_date,
                        b.booking_time
                      ) >= NOW()
                ORDER BY b.booking_date, b.booking_time
                LIMIT 4
            `),

            db.query(`
                SELECT
                    oi.product_name AS name,
                    SUM(oi.quantity) AS quantity,
                    SUM(oi.line_total) AS revenue
                FROM order_items AS oi
                INNER JOIN orders AS o
                    ON o.id = oi.order_id
                WHERE o.status <> 'cancelled'
                  AND o.created_at >= CURDATE()
                  AND o.created_at < CURDATE() + INTERVAL 1 DAY
                GROUP BY oi.product_name
                ORDER BY quantity DESC, revenue DESC
                LIMIT 4
            `),
        ]);

        const tables = tableRows[0] || {};
        const bookings = bookingRows[0] || {};
        const orders = orderRows[0] || {};

        const revenueSeries = revenueRows.map((row) => ({
            key: row.period_key,
            amount: Number(row.amount || 0),
        }));

        const periodRevenue = revenueSeries.reduce(
            (total, item) => total + item.amount,
            0
        );

        return res.json({
            totalTables: Number(tables.total || 0),
            availableTables: Number(tables.available || 0),
            occupiedTables: Number(tables.occupied || 0),
            reservedTables: Number(tables.reserved || 0),
            maintenanceTables: Number(tables.maintenance || 0),

            todayBookings: Number(
                bookings.today_bookings || 0
            ),
            pendingBookings: Number(
                bookings.pending_today || 0
            ),

            totalOrders: Number(orders.total_orders || 0),
            completedOrders: Number(
                orders.completed_orders || 0
            ),
            paidOrdersToday: Number(
                orders.paid_orders_today || 0
            ),

            todayRevenue: Number(
                orders.today_revenue || 0
            ),
            yesterdayRevenue: Number(
                orders.yesterday_revenue || 0
            ),

            todayKey: orders.today_key,
            revenue: {
                period,
                total: periodRevenue,
                series: revenueSeries,
            },
            recentOrders: recentOrderRows.map((row) => ({
                orderCode: row.order_code,
                orderType: row.order_type,
                tableCode: row.table_code,
                totalAmount: Number(row.total_amount || 0),
                status: row.status,
                paymentStatus: row.payment_status,
                createdAt: row.created_at,
            })),
            upcomingBookings: upcomingBookingRows.map((row) => ({
                bookingCode: row.booking_code,
                customerName: row.customer_name,
                bookingDate: row.booking_date,
                bookingTime: row.booking_time,
                guestCount: Number(row.guest_count || 0),
                status: row.status,
                tableCode: row.table_code,
                area: row.area,
            })),
            bestSellers: bestSellerRows.map((row) => ({
                name: row.name,
                quantity: Number(row.quantity || 0),
                revenue: Number(row.revenue || 0),
            })),
        });
    } catch (err) {
        console.error('Lỗi dashboard:', err);

        return res.status(500).json({
            message: dbErrorMessage(
                err,
                'Lỗi lấy số liệu tổng quan!'
            ),
        });
    }
});

module.exports = router;

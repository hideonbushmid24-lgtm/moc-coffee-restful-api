const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { dbErrorMessage } = require('../middleware/dbError');

// GET /api/dashboard/stats - Tổng quan chỉ số (server.js đã gắn verifyToken)
// Gộp 5 truy vấn COUNT thành 3 truy vấn chạy song song, mỗi bảng chỉ quét một lần.
router.get('/stats', async (req, res) => {
    try {
        const [[[tables]], [[bookingStats]], [[orderStats]]] = await Promise.all([
            db.query(
                `SELECT COUNT(*) AS total, COALESCE(SUM(status = 'occupied'), 0) AS occupied
                   FROM coffee_tables`
            ),
            db.query(
                // Bàn đã đặt = số bàn có booking đã xác nhận trong hôm nay
                `SELECT
                    COUNT(DISTINCT CASE WHEN status = 'confirmed' AND booking_date = CURDATE() THEN table_id END) AS reserved,
                    COALESCE(SUM(status = 'pending'), 0) AS pending
                   FROM bookings`
            ),
            db.query(`SELECT COUNT(*) AS completed FROM orders WHERE status = 'completed'`),
        ]);

        res.json({
            totalTables: Number(tables.total),
            occupiedTables: Number(tables.occupied),
            reservedTables: Number(bookingStats.reserved),
            pendingBookings: Number(bookingStats.pending),
            completedOrders: Number(orderStats.completed),
        });
    } catch (err) {
        console.error('Lỗi dashboard:', err);
        res.status(500).json({ message: dbErrorMessage(err, 'Lỗi lấy số liệu tổng quan!') });
    }
});

module.exports = router;
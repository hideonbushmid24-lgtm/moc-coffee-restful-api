const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/dashboard/stats - Tổng quan chỉ số (server.js đã gắn verifyToken)
router.get('/stats', async (req, res) => {
    try {
        const count = async (sql) => {
            const [[row]] = await db.query(sql);
            return row.total;
        };

        const [totalTables, occupiedTables, reservedTables, pendingBookings, completedOrders] = await Promise.all([
            count('SELECT COUNT(*) AS total FROM coffee_tables'),
            count("SELECT COUNT(*) AS total FROM coffee_tables WHERE status = 'occupied'"),
            // Bàn đã đặt = số bàn có booking đã xác nhận trong hôm nay
            count("SELECT COUNT(DISTINCT table_id) AS total FROM bookings WHERE status = 'confirmed' AND booking_date = CURDATE()"),
            count("SELECT COUNT(*) AS total FROM bookings WHERE status = 'pending'"),
            count("SELECT COUNT(*) AS total FROM orders WHERE status = 'completed'")
        ]);

        res.json({ totalTables, occupiedTables, reservedTables, pendingBookings, completedOrders });
    } catch (err) {
        console.error('Lỗi dashboard:', err);
        res.status(500).json({ message: 'Lỗi lấy số liệu tổng quan!' });
    }
});

module.exports = router;

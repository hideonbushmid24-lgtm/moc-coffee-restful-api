const express = require("express");
const {
    createOrder,
} = require("../controllers/order.controller");
const {
    getOrders,
    getOrderById,
    updateOrderStatus,
    confirmOrderPayment,
} = require("../controllers/order.admin.controller");
// Middleware chung của server chính: verifyToken = phải đăng nhập, requireAdmin = phải là admin
const {
    verifyToken,
    requireAdmin,
} = require("../../../middleware/auth");

const router = express.Router();

// Khách hàng không cần đăng nhập vẫn có thể gọi món.
router.post("/", createOrder);

// Các API dưới đây chỉ dành cho admin.
router.get("/", verifyToken, requireAdmin, getOrders);
router.get("/:id", verifyToken, requireAdmin, getOrderById);
router.patch("/:id/status", verifyToken, requireAdmin, updateOrderStatus);
router.patch("/:id/payment", verifyToken, requireAdmin, confirmOrderPayment);

module.exports = router;
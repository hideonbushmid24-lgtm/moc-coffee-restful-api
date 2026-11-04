const express = require("express");

const {
    getProducts,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
} = require("../controllers/product.controller");

// Dùng middleware chung của server chính (có kiểm tra tài khoản trong DB)
const {
    verifyToken: authenticateToken,
    requireAdmin: authorizeAdmin,
} = require("../../../middleware/auth");

const {
    upload,
    verifyImageContent,
} = require("../middleware/upload.middleware");

const router = express.Router();

// Người dùng xem và tìm kiếm sản phẩm hoạt động
router.get("/", getProducts);

// Admin xem tất cả sản phẩm
// Phải đặt trước /:id
router.get(
    "/admin",
    authenticateToken,
    authorizeAdmin,
    getAllProducts
);

// Xem chi tiết sản phẩm
router.get("/:id", getProductById);

// Admin thêm sản phẩm
router.post(
    "/",
    authenticateToken,
    authorizeAdmin,
    upload.single("image"),
    verifyImageContent,
    createProduct
);

// Admin cập nhật sản phẩm
router.put(
    "/:id",
    authenticateToken,
    authorizeAdmin,
    upload.single("image"),
    verifyImageContent,
    updateProduct
);

// Admin xóa sản phẩm
router.delete(
    "/:id",
    authenticateToken,
    authorizeAdmin,
    deleteProduct
);

module.exports = router;
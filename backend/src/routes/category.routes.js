const express = require("express");

const {
    getCategories,
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
} = require("../controllers/category.controller");

// Dùng middleware chung của server chính (có kiểm tra tài khoản trong DB)
const {
    verifyToken: authenticateToken,
    requireAdmin: authorizeAdmin,
} = require("../../../middleware/auth");

const router = express.Router();

router.get("/", getCategories);

router.get(
    "/admin",
    authenticateToken,
    authorizeAdmin,
    getAllCategories
);

router.get("/:id", getCategoryById);

router.post(
    "/",
    authenticateToken,
    authorizeAdmin,
    createCategory
);

router.put(
    "/:id",
    authenticateToken,
    authorizeAdmin,
    updateCategory
);

router.delete(
    "/:id",
    authenticateToken,
    authorizeAdmin,
    deleteCategory
);

module.exports = router;
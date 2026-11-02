// Dùng chung kết nối DB của server chính
const pool = require("../../../config/db");

const createSlug = (value) => {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
};

const parseCategoryId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

const parseStatus = (value, defaultValue) => {
    if (value === undefined) {
        return defaultValue;
    }

    const status = Number(value);

    if (status !== 0 && status !== 1) {
        return null;
    }

    return status;
};

// GET /api/categories
// Danh sách danh mục đang hoạt động
const getCategories = async (req, res) => {
    try {
        const [categories] = await pool.execute(
            `SELECT
                id,
                name,
                slug,
                description
             FROM categories
             WHERE status = 1
             ORDER BY name ASC`
        );

        return res.status(200).json({
            success: true,
            count: categories.length,
            data: categories,
        });
    } catch (error) {
        console.error("Lỗi lấy danh mục:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi lấy danh mục",
        });
    }
};

// GET /api/categories/admin
// Admin xem tất cả danh mục
const getAllCategories = async (req, res) => {
    try {
        const [categories] = await pool.execute(
            `SELECT
                c.id,
                c.name,
                c.slug,
                c.description,
                c.status,
                c.created_at,
                c.updated_at,
                COUNT(p.id) AS product_count
             FROM categories AS c
             LEFT JOIN products AS p
                ON p.category_id = c.id
             GROUP BY
                c.id,
                c.name,
                c.slug,
                c.description,
                c.status,
                c.created_at,
                c.updated_at
             ORDER BY c.id DESC`
        );

        return res.status(200).json({
            success: true,
            count: categories.length,
            data: categories,
        });
    } catch (error) {
        console.error(
            "Lỗi lấy danh mục Admin:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi lấy danh mục",
        });
    }
};

// GET /api/categories/:id
const getCategoryById = async (req, res) => {
    try {
        const categoryId = parseCategoryId(
            req.params.id
        );

        if (!categoryId) {
            return res.status(400).json({
                success: false,
                message: "ID danh mục không hợp lệ",
            });
        }

        const [categories] = await pool.execute(
            `SELECT
                id,
                name,
                slug,
                description,
                status,
                created_at,
                updated_at
             FROM categories
             WHERE id = ?
             LIMIT 1`,
            [categoryId]
        );

        if (categories.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy danh mục",
            });
        }

        return res.status(200).json({
            success: true,
            data: categories[0],
        });
    } catch (error) {
        console.error(
            "Lỗi lấy chi tiết danh mục:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Lỗi máy chủ khi lấy danh mục",
        });
    }
};

// POST /api/categories
const createCategory = async (req, res) => {
    try {
        let { name, description, status } = req.body;

        name =
            typeof name === "string"
                ? name.trim()
                : "";

        description =
            typeof description === "string"
                ? description.trim()
                : null;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Tên danh mục là bắt buộc",
            });
        }

        if (name.length > 100) {
            return res.status(400).json({
                success: false,
                message:
                    "Tên danh mục không quá 100 ký tự",
            });
        }

        status = parseStatus(status, 1);

        if (status === null) {
            return res.status(400).json({
                success: false,
                message: "Trạng thái không hợp lệ",
            });
        }

        const slug = createSlug(name);

        if (!slug) {
            return res.status(400).json({
                success: false,
                message:
                    "Không thể tạo slug từ tên danh mục",
            });
        }

        const [existingCategories] =
            await pool.execute(
                `SELECT id
                 FROM categories
                 WHERE name = ? OR slug = ?
                 LIMIT 1`,
                [name, slug]
            );

        if (existingCategories.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Danh mục đã tồn tại",
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO categories
                (name, slug, description, status)
             VALUES (?, ?, ?, ?)`,
            [name, slug, description, status]
        );

        return res.status(201).json({
            success: true,
            message: "Thêm danh mục thành công",
            data: {
                id: result.insertId,
                name,
                slug,
                description,
                status,
            },
        });
    } catch (error) {
        console.error("Lỗi thêm danh mục:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Danh mục đã tồn tại",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi thêm danh mục",
        });
    }
};

// PUT /api/categories/:id
const updateCategory = async (req, res) => {
    try {
        const categoryId = parseCategoryId(
            req.params.id
        );

        if (!categoryId) {
            return res.status(400).json({
                success: false,
                message: "ID danh mục không hợp lệ",
            });
        }

        const [categories] = await pool.execute(
            `SELECT *
             FROM categories
             WHERE id = ?
             LIMIT 1`,
            [categoryId]
        );

        if (categories.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy danh mục",
            });
        }

        const currentCategory = categories[0];

        const name =
            typeof req.body.name === "string"
                ? req.body.name.trim()
                : "";

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Tên danh mục là bắt buộc",
            });
        }

        if (name.length > 100) {
            return res.status(400).json({
                success: false,
                message:
                    "Tên danh mục không quá 100 ký tự",
            });
        }

        const description =
            req.body.description === undefined
                ? currentCategory.description
                : String(
                      req.body.description
                  ).trim() || null;

        const status = parseStatus(
            req.body.status,
            Number(currentCategory.status)
        );

        if (status === null) {
            return res.status(400).json({
                success: false,
                message: "Trạng thái không hợp lệ",
            });
        }

        const slug = createSlug(name);

        const [duplicatedCategories] =
            await pool.execute(
                `SELECT id
                 FROM categories
                 WHERE (name = ? OR slug = ?)
                   AND id <> ?
                 LIMIT 1`,
                [name, slug, categoryId]
            );

        if (duplicatedCategories.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Tên danh mục đã được sử dụng",
            });
        }

        await pool.execute(
            `UPDATE categories
             SET
                name = ?,
                slug = ?,
                description = ?,
                status = ?
             WHERE id = ?`,
            [
                name,
                slug,
                description,
                status,
                categoryId,
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Cập nhật danh mục thành công",
            data: {
                id: categoryId,
                name,
                slug,
                description,
                status,
            },
        });
    } catch (error) {
        console.error(
            "Lỗi cập nhật danh mục:",
            error
        );

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message:
                    "Tên danh mục đã được sử dụng",
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Lỗi máy chủ khi cập nhật danh mục",
        });
    }
};

// DELETE /api/categories/:id
const deleteCategory = async (req, res) => {
    try {
        const categoryId = parseCategoryId(
            req.params.id
        );

        if (!categoryId) {
            return res.status(400).json({
                success: false,
                message: "ID danh mục không hợp lệ",
            });
        }

        const [categories] = await pool.execute(
            `SELECT id, name
             FROM categories
             WHERE id = ?
             LIMIT 1`,
            [categoryId]
        );

        if (categories.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy danh mục",
            });
        }

        const [productCounts] = await pool.execute(
            `SELECT COUNT(*) AS total
             FROM products
             WHERE category_id = ?`,
            [categoryId]
        );

        if (Number(productCounts[0].total) > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Không thể xóa danh mục đang có sản phẩm",
            });
        }

        await pool.execute(
            `DELETE FROM categories WHERE id = ?`,
            [categoryId]
        );

        return res.status(200).json({
            success: true,
            message: "Xóa danh mục thành công",
        });
    } catch (error) {
        console.error("Lỗi xóa danh mục:", error);

        if (
            error.code ===
            "ER_ROW_IS_REFERENCED_2"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Không thể xóa danh mục đang được sử dụng",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi xóa danh mục",
        });
    }
};

module.exports = {
    getCategories,
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
};
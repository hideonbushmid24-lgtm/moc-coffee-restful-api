// Dùng chung kết nối DB của server chính
const pool = require("../../../config/db");
const fs = require("fs/promises");
const path = require("path");

const productUploadDirectory = path.join(
    __dirname,
    "../../uploads/products"
);

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

const parsePositiveId = (value) => {
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

const createUploadedImagePath = (file) => {
    if (!file) {
        return null;
    }

    return `/uploads/products/${file.filename}`;
};

const removeUploadedFile = async (file) => {
    if (!file?.path) {
        return;
    }

    try {
        await fs.unlink(file.path);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(
                "Lỗi xóa file vừa upload:",
                error
            );
        }
    }
};

const removeStoredImage = async (imagePath) => {
    if (
        typeof imagePath !== "string" ||
        !imagePath.startsWith("/uploads/products/")
    ) {
        return;
    }

    const filename = path.basename(imagePath);

    try {
        await fs.unlink(
            path.join(
                productUploadDirectory,
                filename
            )
        );
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(
                "Lỗi xóa ảnh sản phẩm:",
                error
            );
        }
    }
};

const rejectUploadedRequest = async (
    req,
    res,
    statusCode,
    message
) => {
    await removeUploadedFile(req.file);

    return res.status(statusCode).json({
        success: false,
        message,
    });
};

const formatProduct = (req, product) => {
    let imageUrl = null;

    if (
        typeof product.image === "string" &&
        product.image.startsWith("/uploads/")
    ) {
        imageUrl =
            `${req.protocol}://${req.get("host")}` +
            product.image;
    }

    return {
        ...product,
        image_url: imageUrl,
    };
};

// Escape % và _ để người dùng gõ "50%" hay "a_b" thì tìm đúng ký tự đó, không bị hiểu là ký tự đại diện của LIKE
const escapeLike = (text) => text.replace(/[\\%_]/g, "\\$&");

// Dùng chung cho GET /api/products (khách) và GET /api/products/admin
// onlyActive = true: chỉ sản phẩm và danh mục đang hoạt động
const listProducts = async (req, res, onlyActive, errorLabel) => {
    try {
        const search =
            typeof req.query.search === "string"
                ? req.query.search.trim().slice(0, 100)
                : "";

        let categoryId = null;


        if (req.query.category_id !== undefined) {
            categoryId = parsePositiveId(
                req.query.category_id
            );

            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "ID danh mục không hợp lệ",
                });
            }
        }

        const conditions = onlyActive
            ? ["p.status = 1", "c.status = 1"]
            : [];

        const values = [];

        if (search) {
            conditions.push(
                `(p.name LIKE ?
                  OR p.description LIKE ?)`
            );

            const keyword = `%${escapeLike(search)}%`;

            values.push(keyword, keyword);
        }


        if (categoryId) {
            conditions.push("p.category_id = ?");
            values.push(categoryId);
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const [products] = await pool.execute(
            `SELECT
                p.id,
                p.category_id,
                c.name AS category_name,
                p.name,
                p.slug,
                p.description,
                p.price,
                p.image,
                p.status,
                p.created_at,
                p.updated_at,
                COALESCE(sales.sold_count, 0) AS sold_count
             FROM products AS p
             INNER JOIN categories AS c
                ON c.id = p.category_id
             LEFT JOIN (
                SELECT
                    oi.product_id,
                    SUM(oi.quantity) AS sold_count
                FROM order_items AS oi
                INNER JOIN orders AS o
                    ON o.id = oi.order_id
                WHERE o.status <> 'cancelled'
                GROUP BY oi.product_id
             ) AS sales
                ON sales.product_id = p.id
             ${whereClause}
             ORDER BY p.id DESC`,
            values
        );

        return res.status(200).json({
            success: true,
            count: products.length,
            data: products.map((product) =>
                formatProduct(req, product)
            ),
        });
    } catch (error) {
        console.error(errorLabel, error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi lấy sản phẩm",
        });
    }
};

// GET /api/products
const getProducts = (req, res) =>
    listProducts(req, res, true, "Lỗi lấy sản phẩm:");

// GET /api/products/admin
const getAllProducts = (req, res) =>
    listProducts(req, res, false, "Lỗi lấy sản phẩm Admin:");

// GET /api/products/:id
const getProductById = async (req, res) => {
    try {
        const productId = parsePositiveId(
            req.params.id
        );

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "ID sản phẩm không hợp lệ",
            });
        }

        const [products] = await pool.execute(
            `SELECT
                p.id,
                p.category_id,
                c.name AS category_name,
                p.name,
                p.slug,
                p.description,
                p.price,
                p.image,
                p.status,
                p.created_at,
                p.updated_at
             FROM products AS p
             INNER JOIN categories AS c
                ON c.id = p.category_id
             WHERE p.id = ?
               AND p.status = 1
               AND c.status = 1
             LIMIT 1`,
            [productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm",
            });
        }

        return res.status(200).json({
            success: true,
            data: formatProduct(req, products[0]),
        });
    } catch (error) {
        console.error(
            "Lỗi lấy chi tiết sản phẩm:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi lấy sản phẩm",
        });
    }
};

// POST /api/products
const createProduct = async (req, res) => {
    try {
        const categoryId = parsePositiveId(
            req.body.category_id
        );

        const name =
            typeof req.body.name === "string"
                ? req.body.name.trim()
                : "";

        const description =
            typeof req.body.description === "string"
                ? req.body.description.trim() || null
                : null;

        const priceText =
            req.body.price === undefined
                ? ""
                : String(req.body.price).trim();

        const price = Number(priceText);

        const status = parseStatus(
            req.body.status,
            1
        );

        if (!categoryId) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Danh mục không hợp lệ"
            );
        }

        if (!name) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Tên sản phẩm là bắt buộc"
            );
        }

        if (name.length > 150) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Tên sản phẩm không quá 150 ký tự"
            );
        }

        if (
            priceText === "" ||
            !Number.isFinite(price) ||
            price < 0 ||
            price > 9999999999.99
        ) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Giá sản phẩm không hợp lệ"
            );
        }

        if (status === null) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Trạng thái không hợp lệ"
            );
        }

        const [categories] = await pool.execute(
            `SELECT id
             FROM categories
             WHERE id = ?
             LIMIT 1`,
            [categoryId]
        );

        if (categories.length === 0) {
            return rejectUploadedRequest(
                req,
                res,
                404,
                "Không tìm thấy danh mục"
            );
        }

        const slug = createSlug(name);

        if (!slug) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Không thể tạo slug từ tên sản phẩm"
            );
        }

        const [duplicatedProducts] =
            await pool.execute(
                `SELECT id
                 FROM products
                 WHERE slug = ?
                 LIMIT 1`,
                [slug]
            );

        if (duplicatedProducts.length > 0) {
            return rejectUploadedRequest(
                req,
                res,
                409,
                "Tên sản phẩm đã được sử dụng"
            );
        }

        const image =
            createUploadedImagePath(req.file);

        const [result] = await pool.execute(
            `INSERT INTO products
                (
                    category_id,
                    name,
                    slug,
                    description,
                    price,
                    image,
                    status
                )
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                categoryId,
                name,
                slug,
                description,
                price,
                image,
                status,
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Thêm sản phẩm thành công",
            data: {
                id: result.insertId,
                category_id: categoryId,
                name,
                slug,
                description,
                price,
                image,
                status,
            },
        });
    } catch (error) {
        await removeUploadedFile(req.file);

        console.error("Lỗi thêm sản phẩm:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message:
                    "Tên sản phẩm đã được sử dụng",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi thêm sản phẩm",
        });
    }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
    try {
        const productId = parsePositiveId(
            req.params.id
        );

        if (!productId) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "ID sản phẩm không hợp lệ"
            );
        }

        const [products] = await pool.execute(
            `SELECT *
             FROM products
             WHERE id = ?
             LIMIT 1`,
            [productId]
        );

        if (products.length === 0) {
            return rejectUploadedRequest(
                req,
                res,
                404,
                "Không tìm thấy sản phẩm"
            );
        }

        const currentProduct = products[0];

        const categoryId =
            req.body.category_id === undefined
                ? Number(currentProduct.category_id)
                : parsePositiveId(
                      req.body.category_id
                  );

        const name =
            req.body.name === undefined
                ? currentProduct.name
                : String(req.body.name).trim();

        const description =
            req.body.description === undefined
                ? currentProduct.description
                : String(
                      req.body.description
                  ).trim() || null;

        const priceText =
            req.body.price === undefined
                ? String(currentProduct.price)
                : String(req.body.price).trim();

        const price = Number(priceText);

        const status = parseStatus(
            req.body.status,
            Number(currentProduct.status)
        );

        if (!categoryId) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Danh mục không hợp lệ"
            );
        }

        if (!name || name.length > 150) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Tên sản phẩm không hợp lệ"
            );
        }

        if (
            priceText === "" ||
            !Number.isFinite(price) ||
            price < 0 ||
            price > 9999999999.99
        ) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Giá sản phẩm không hợp lệ"
            );
        }

        if (status === null) {
            return rejectUploadedRequest(
                req,
                res,
                400,
                "Trạng thái không hợp lệ"
            );
        }

        const [categories] = await pool.execute(
            `SELECT id
             FROM categories
             WHERE id = ?
             LIMIT 1`,
            [categoryId]
        );

        if (categories.length === 0) {
            return rejectUploadedRequest(
                req,
                res,
                404,
                "Không tìm thấy danh mục"
            );
        }

        const slug = createSlug(name);

        const [duplicatedProducts] =
            await pool.execute(
                `SELECT id
                 FROM products
                 WHERE slug = ?
                   AND id <> ?
                 LIMIT 1`,
                [slug, productId]
            );

        if (duplicatedProducts.length > 0) {
            return rejectUploadedRequest(
                req,
                res,
                409,
                "Tên sản phẩm đã được sử dụng"
            );
        }

        const image = req.file
            ? createUploadedImagePath(req.file)
            : currentProduct.image;

        await pool.execute(
            `UPDATE products
             SET
                category_id = ?,
                name = ?,
                slug = ?,
                description = ?,
                price = ?,
                image = ?,
                status = ?
             WHERE id = ?`,
            [
                categoryId,
                name,
                slug,
                description,
                price,
                image,
                status,
                productId,
            ]
        );

        if (req.file) {
            await removeStoredImage(
                currentProduct.image
            );
        }

        return res.status(200).json({
            success: true,
            message: "Cập nhật sản phẩm thành công",
            data: {
                id: productId,
                category_id: categoryId,
                name,
                slug,
                description,
                price,
                image,
                status,
            },
        });
    } catch (error) {
        await removeUploadedFile(req.file);

        console.error(
            "Lỗi cập nhật sản phẩm:",
            error
        );

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message:
                    "Tên sản phẩm đã được sử dụng",
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Lỗi máy chủ khi cập nhật sản phẩm",
        });
    }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
    try {
        const productId = parsePositiveId(
            req.params.id
        );

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "ID sản phẩm không hợp lệ",
            });
        }

        const [products] = await pool.execute(
            `SELECT id, image
             FROM products
             WHERE id = ?
             LIMIT 1`,
            [productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm",
            });
        }

        await pool.execute(
            `DELETE FROM products WHERE id = ?`,
            [productId]
        );

        await removeStoredImage(products[0].image);

        return res.status(200).json({
            success: true,
            message: "Xóa sản phẩm thành công",
        });
    } catch (error) {
        console.error("Lỗi xóa sản phẩm:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi xóa sản phẩm",
        });
    }
};

module.exports = {
    getProducts,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
};

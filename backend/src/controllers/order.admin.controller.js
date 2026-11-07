// Các API quản lý đơn hàng dành cho ADMIN:
//   - xem danh sách, xem chi tiết
//   - đổi trạng thái xử lý đơn
//   - xác nhận thanh toán
// (API khách đặt món nằm ở order.controller.js)
const pool = require("../../../config/db");
const { dbErrorMessage } = require("../../../middleware/dbError");

// ===== Hằng số =====
const ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];
const PAYMENT_STATUSES = ["pending", "pending_verification", "paid", "failed", "refunded"];
const ORDER_TYPES = ["at_table", "takeaway"];
const PAYMENT_METHODS = ["cash", "bank_transfer"];

// Trạng thái hóa đơn = suy ra từ đơn (chỉ dùng chuỗi có sẵn, không ghép dữ liệu người dùng)
const INVOICE_STATUS_SQL = {
    cancelled: "o.status = 'cancelled'",
    paid: "o.status <> 'cancelled' AND o.payment_status = 'paid'",
    failed: "o.status <> 'cancelled' AND o.payment_status = 'failed'",
    refunded: "o.status <> 'cancelled' AND o.payment_status = 'refunded'",
    pending: "o.status <> 'cancelled' AND o.payment_status IN ('pending', 'pending_verification')",
};

const STATUS_TEXT = {
    pending: "Đơn mới",
    confirmed: "Đã xác nhận",
    preparing: "Đang chế biến",
    ready: "Sẵn sàng phục vụ",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
};

const PAYMENT_STATUS_TEXT = {
    pending: "Chưa thanh toán",
    pending_verification: "Chờ xác nhận chuyển khoản",
    paid: "Đã thanh toán",
    failed: "Thanh toán thất bại",
    refunded: "Đã hoàn tiền",
};

// Từ trạng thái hiện tại, được phép chuyển sang những trạng thái nào
const NEXT_STATUSES = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
};

// Các kiểu sắp xếp cho phép (chỉ dùng chuỗi có sẵn, không ghép dữ liệu người dùng vào SQL)
const SORTS = {
    newest: "o.created_at DESC, o.id DESC",
    oldest: "o.created_at ASC, o.id ASC",
    amount_desc: "o.total_amount DESC, o.id DESC",
    amount_asc: "o.total_amount ASC, o.id ASC",
};

// ===== Hàm hỗ trợ =====
const parseId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

// Chuyển một dòng orders trong DB thành dữ liệu trả về (số tiền là số, thêm chữ tiếng Việt)
const formatOrder = (row) => ({
    id: row.id,
    order_code: row.order_code,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_email: row.customer_email,
    order_type: row.order_type,
    order_type_text: row.order_type === "at_table" ? "Dùng tại bàn" : "Mang đi",
    table_code: row.table_code,
    note: row.note,
    coupon_code: row.coupon_code,
    subtotal: Number(row.subtotal),
    discount_amount: Number(row.discount_amount),
    service_fee: Number(row.service_fee),
    total_amount: Number(row.total_amount),
    payment_method: row.payment_method,
    payment_method_text: row.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản",
    payment_status: row.payment_status,
    payment_status_text: PAYMENT_STATUS_TEXT[row.payment_status],
    status: row.status,
    status_text: STATUS_TEXT[row.status],
    created_at: row.created_at,
    updated_at: row.updated_at,
});

const parseToppings = (value) => {
    try {
        const list = JSON.parse(value || "[]");
        return Array.isArray(list) ? list : [];
    } catch (error) {
        return [];
    }
};

const sendError = (res, httpStatus, message) =>
    res.status(httpStatus).json({ success: false, message });

// ===== GET /api/orders : danh sách đơn =====
// Lọc: ?status= &payment_status= &order_type= &date=YYYY-MM-DD &q=từ khóa
// Sắp xếp: ?sort=newest|oldest|amount_desc|amount_asc   Phân trang: ?page= &limit=
const getOrders = async (req, res) => {
    const { status, payment_status, order_type, date, q, sort } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
        // Cho phép nhiều trạng thái cách nhau bằng dấu phẩy, ví dụ ?status=confirmed,preparing
        const list = String(status).split(",").map((item) => item.trim()).filter(Boolean);
        if (!list.length || list.some((item) => !ORDER_STATUSES.includes(item))) {
            return sendError(res, 400, "Trạng thái đơn không hợp lệ");
        }
        conditions.push(`o.status IN (${list.map(() => "?").join(", ")})`);
        params.push(...list);
    }

    // ?awaiting_payment=1 : đơn chưa thanh toán và chưa hủy (tab "Chờ thanh toán")
    if (req.query.awaiting_payment === "1") {
        conditions.push("o.payment_status IN ('pending', 'pending_verification') AND o.status <> 'cancelled'");
    }

    // ?payment_method=cash|bank_transfer
    if (req.query.payment_method) {
        if (!PAYMENT_METHODS.includes(req.query.payment_method)) return sendError(res, 400, "Phương thức thanh toán không hợp lệ");
        conditions.push("o.payment_method = ?");
        params.push(req.query.payment_method);
    }

    // ?invoice_status=pending|paid|cancelled|failed|refunded : trạng thái hóa đơn suy ra từ đơn
    if (req.query.invoice_status) {
        const clause = INVOICE_STATUS_SQL[req.query.invoice_status];
        if (!clause) return sendError(res, 400, "Trạng thái hóa đơn không hợp lệ");
        conditions.push(clause);
    }

    if (payment_status) {
        if (!PAYMENT_STATUSES.includes(payment_status)) return sendError(res, 400, "Trạng thái thanh toán không hợp lệ");
        conditions.push("o.payment_status = ?");
        params.push(payment_status);
    }

    if (order_type) {
        if (!ORDER_TYPES.includes(order_type)) return sendError(res, 400, "Loại đơn không hợp lệ");
        conditions.push("o.order_type = ?");
        params.push(order_type);
    }

    if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendError(res, 400, "Ngày phải có dạng YYYY-MM-DD");
        // Dùng khoảng thời gian thay vì DATE(cột) để MySQL dùng được index idx_orders_created_at
        conditions.push("o.created_at >= ? AND o.created_at < ? + INTERVAL 1 DAY");
        params.push(date, date);
    }

    // Khoảng ngày cho trang hóa đơn: ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (req.query.date_from) {
        if (!DATE_RE.test(req.query.date_from)) return sendError(res, 400, "Ngày phải có dạng YYYY-MM-DD");
        conditions.push("o.created_at >= ?");
        params.push(req.query.date_from);
    }
    if (req.query.date_to) {
        if (!DATE_RE.test(req.query.date_to)) return sendError(res, 400, "Ngày phải có dạng YYYY-MM-DD");
        conditions.push("o.created_at < ? + INTERVAL 1 DAY");
        params.push(req.query.date_to);
    }

    if (q) {
        const keyword = `%${String(q).trim().slice(0, 50).replace(/[\\%_]/g, "\\$&")}%`;
        const invoiceMatch = /^hd0*(\d+)$/i.exec(String(q).trim()); // gõ "HD0012" thì tìm đơn id = 12
        conditions.push("(o.order_code LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.table_code LIKE ?" + (invoiceMatch ? " OR o.id = ?" : "") + ")");
        params.push(keyword, keyword, keyword, keyword);
        if (invoiceMatch) params.push(Number(invoiceMatch[1]));
    }

    const orderBy = SORTS[sort] || SORTS.newest;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        // 3 truy vấn độc lập -> chạy song song thay vì chờ lần lượt.
        // item_count dùng subquery nên chỉ tính cho đúng các dòng của trang hiện tại
        // (trước đây JOIN + GROUP BY trên toàn bộ đơn rồi mới LIMIT).
        const [[rows], [[totalRow]], [[summary]]] = await Promise.all([
            pool.query(
                `SELECT o.*,
                        (SELECT COALESCE(SUM(oi.quantity), 0)
                           FROM order_items oi
                          WHERE oi.order_id = o.id) AS item_count
                   FROM orders o
                   ${where}
                  ORDER BY ${orderBy}
                  LIMIT ? OFFSET ?`,
                [...params, limit, (page - 1) * limit]
            ),
            pool.query(
                `SELECT COUNT(*) AS total FROM orders o ${where}`,
                params
            ),
            // Số liệu cho các thẻ thống kê đầu trang (tính trên tất cả đơn, không phụ thuộc bộ lọc)
            pool.query(
                `SELECT
                    COUNT(*) AS all_orders,
                    SUM(created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY) AS today_orders,
                    SUM(status = 'pending') AS pending_orders,
                    SUM(status IN ('confirmed', 'preparing')) AS preparing_orders,
                    SUM(status = 'ready') AS ready_orders,
                    SUM(status = 'completed') AS completed_orders,
                    SUM(status = 'cancelled') AS cancelled_orders,
                    SUM(payment_status IN ('pending', 'pending_verification') AND status <> 'cancelled') AS awaiting_payment,
                    SUM(payment_status = 'paid' AND status <> 'cancelled') AS paid_invoices,
                    SUM(status <> 'cancelled' AND created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY) AS today_invoices,
                    COALESCE(SUM(CASE WHEN payment_status = 'paid' AND status <> 'cancelled'
                                      AND created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY
                                 THEN total_amount END), 0) AS today_revenue
                   FROM orders`
            ),
        ]);

        return res.json({
            success: true,
            count: rows.length,
            total: totalRow.total,
            page,
            limit,
            total_pages: Math.max(1, Math.ceil(totalRow.total / limit)),
            summary: Object.fromEntries(
                Object.entries(summary).map(([key, value]) => [key, Number(value || 0)])
            ),
            data: rows.map((row) => ({ ...formatOrder(row), item_count: Number(row.item_count) })),
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách đơn hàng:", error);
        return sendError(res, 500, dbErrorMessage(error, "Lỗi máy chủ khi lấy danh sách đơn hàng"));
    }
};

// ===== GET /api/orders/:id : chi tiết một đơn (kèm các món) =====
const getOrderById = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Mã đơn không hợp lệ");

    try {
        const [orders] = await pool.execute("SELECT * FROM orders WHERE id = ?", [id]);
        if (!orders.length) return sendError(res, 404, "Không tìm thấy đơn hàng");

        const [items] = await pool.execute(
            `SELECT product_id, product_name, product_image, unit_price, quantity, line_total,
                    size, sugar_level, ice_level, toppings, note
               FROM order_items WHERE order_id = ? ORDER BY id`,
            [id]
        );

        return res.json({
            success: true,
            data: {
                ...formatOrder(orders[0]),
                items: items.map((item) => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    image: item.product_image,
                    unit_price: Number(item.unit_price),
                    quantity: item.quantity,
                    line_total: Number(item.line_total),
                    size: item.size,
                    sugar_level: item.sugar_level,
                    ice_level: item.ice_level,
                    toppings: parseToppings(item.toppings),
                    note: item.note,
                })),
            },
        });
    } catch (error) {
        console.error("Lỗi lấy chi tiết đơn hàng:", error);
        return sendError(res, 500, "Lỗi máy chủ khi lấy chi tiết đơn hàng");
    }
};

// ===== PATCH /api/orders/:id/status : đổi trạng thái xử lý =====
// Body: { "status": "confirmed" }
const updateOrderStatus = async (req, res) => {
    const id = parseId(req.params.id);
    const newStatus = req.body && req.body.status;

    if (!id) return sendError(res, 400, "Mã đơn không hợp lệ");
    if (!ORDER_STATUSES.includes(newStatus)) return sendError(res, 400, "Trạng thái đơn không hợp lệ");

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Khóa dòng đơn để hai người cùng bấm một lúc không ghi đè nhau
        const [rows] = await connection.execute(
            "SELECT id, status, payment_status, order_type, table_code FROM orders WHERE id = ? FOR UPDATE",
            [id]
        );

        if (!rows.length) {
            await connection.rollback();
            return sendError(res, 404, "Không tìm thấy đơn hàng");
        }

        const order = rows[0];

        if (!NEXT_STATUSES[order.status].includes(newStatus)) {
            await connection.rollback();
            return sendError(res, 409, `Không thể chuyển đơn từ "${STATUS_TEXT[order.status]}" sang "${STATUS_TEXT[newStatus]}"`);
        }

        if (newStatus === "completed" && order.payment_status !== "paid") {
            await connection.rollback();
            return sendError(res, 409, "Cần xác nhận thanh toán trước khi hoàn thành đơn");
        }

        if (newStatus === "cancelled" && order.payment_status === "paid") {
            await connection.rollback();
            return sendError(res, 409, "Đơn đã thanh toán nên không thể hủy");
        }

        await connection.execute("UPDATE orders SET status = ? WHERE id = ?", [newStatus, id]);

        // Trả bàn khi đơn kết thúc/hủy, nhưng chỉ khi bàn không còn đơn mở
        // và cũng không có booking đang phục vụ.
        if (
            order.order_type === "at_table" &&
            order.table_code &&
            (newStatus === "completed" || newStatus === "cancelled")
        ) {
            const [openOrders] = await connection.execute(
                `SELECT id
                   FROM orders
                  WHERE table_code = ?
                    AND id <> ?
                    AND status <> 'cancelled'
                    AND (status <> 'completed' OR payment_status NOT IN ('paid', 'refunded'))
                  LIMIT 1
                  FOR UPDATE`,
                [order.table_code, id]
            );
            const [seatedBookings] = await connection.execute(
                `SELECT b.id
                   FROM bookings b
                   INNER JOIN coffee_tables t ON t.id = b.table_id
                  WHERE t.table_code = ? AND b.status = 'seated'
                  LIMIT 1
                  FOR UPDATE`,
                [order.table_code]
            );

            if (!openOrders.length && !seatedBookings.length) {
                await connection.execute(
                    `UPDATE coffee_tables
                        SET status = 'available'
                      WHERE table_code = ? AND status = 'occupied'`,
                    [order.table_code]
                );
            }
        }
        await connection.commit();

        return res.json({
            success: true,
            message: `Đã chuyển đơn sang "${STATUS_TEXT[newStatus]}"`,
            data: { id, status: newStatus, status_text: STATUS_TEXT[newStatus], payment_status: order.payment_status },
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Lỗi đổi trạng thái đơn hàng:", error);
        return sendError(res, 500, "Lỗi máy chủ khi đổi trạng thái đơn hàng");
    } finally {
        if (connection) connection.release();
    }
};

// ===== PATCH /api/orders/:id/payment : xác nhận đã thanh toán =====
// Chỉ đổi được khi đơn đang "chưa thanh toán" hoặc "chờ xác nhận chuyển khoản" và chưa bị hủy.
// Câu UPDATE có điều kiện nên bấm hai lần (hoặc hai người cùng bấm) chỉ ghi nhận MỘT lần.
const confirmOrderPayment = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Mã đơn không hợp lệ");

    try {
        const [result] = await pool.execute(
            `UPDATE orders
                SET payment_status = 'paid'
              WHERE id = ?
                AND payment_status IN ('pending', 'pending_verification')
                AND status <> 'cancelled'`,
            [id]
        );

        if (result.affectedRows === 0) {
            // Không cập nhật được: tìm lý do để báo cho admin
            const [rows] = await pool.execute("SELECT status, payment_status FROM orders WHERE id = ?", [id]);

            if (!rows.length) return sendError(res, 404, "Không tìm thấy đơn hàng");
            if (rows[0].status === "cancelled") return sendError(res, 409, "Đơn đã bị hủy, không thể xác nhận thanh toán");
            if (rows[0].payment_status === "paid") return sendError(res, 409, "Đơn hàng này đã được thanh toán");
            return sendError(res, 409, `Không thể xác nhận thanh toán khi đơn đang ở trạng thái "${PAYMENT_STATUS_TEXT[rows[0].payment_status]}"`);
        }

        const [rows] = await pool.execute("SELECT * FROM orders WHERE id = ?", [id]);

        return res.json({
            success: true,
            message: "Đã xác nhận thanh toán",
            data: formatOrder(rows[0]),
        });
    } catch (error) {
        console.error("Lỗi xác nhận thanh toán:", error);
        return sendError(res, 500, "Lỗi máy chủ khi xác nhận thanh toán");
    }
};

module.exports = {
    getOrders,
    getOrderById,
    updateOrderStatus,
    confirmOrderPayment,
};

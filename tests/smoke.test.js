// Kiểm tra nhanh các API chính. KHÔNG cần MySQL: file này thay kết nối DB bằng bản giả.
// Chạy: npm test
process.env.JWT_SECRET = 'chuoi-bi-mat-dung-de-test-'.padEnd(40, 'x');
process.env.AUTH_CACHE_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const jwt = require('jsonwebtoken');

// ----- DB giả: ghi lại câu SQL và trả dữ liệu mẫu -----
const calls = [];
function answer(sql) {
    if (/FROM users/.test(sql)) return [[{ id: 1, full_name: 'Admin', email: 'a@a.vn', role: 'admin', status: 1 }]];
    if (/FROM coffee_tables WHERE table_code/.test(sql)) return [[{ status: 'available' }]];
    if (/FROM products AS p/.test(sql)) return [[{ id: 1, name: 'Cà phê sữa đá', price: '29000.00', image: '/uploads/products/a.jpg' }]];
    if (/INSERT INTO orders/.test(sql)) return [{ insertId: 7 }];
    if (/INSERT INTO order_items/.test(sql)) return [{ affectedRows: 2 }];
    if (/AS item_count/.test(sql)) return [[{ id: 1, order_code: 'MC1', total_amount: '1', subtotal: '1', discount_amount: '0', service_fee: '0', order_type: 'takeaway', payment_method: 'cash', payment_status: 'pending', status: 'pending', item_count: '2' }]];
    if (/COUNT\(\*\) AS total FROM orders/.test(sql)) return [[{ total: 45 }]];
    if (/AS all_orders/.test(sql)) return [[{ all_orders: 45, today_orders: 3, pending_orders: 2, awaiting_payment: 4 }]];
    if (/AS total, COALESCE/.test(sql)) return [[{ total: 8, occupied: '2' }]];
    if (/AS reserved/.test(sql)) return [[{ reserved: 1, pending: '3' }]];
    if (/AS completed/.test(sql)) return [[{ completed: 5 }]];
    return [[]];
}
const record = (kind) => async (sql, params) => { calls.push({ kind, sql: String(sql).replace(/\s+/g, ' '), params }); return answer(sql); };
const connection = {
    beginTransaction: async () => calls.push({ kind: 'begin' }),
    commit: async () => calls.push({ kind: 'commit' }),
    rollback: async () => calls.push({ kind: 'rollback' }),
    release() {},
    execute: record('conn.execute'),
    query: record('conn.query'),
};
const fakeDb = { execute: record('execute'), query: record('query'), getConnection: async () => connection, end: async () => {} };
const dbFile = require.resolve('../config/db.js');
require.cache[dbFile] = { id: dbFile, filename: dbFile, loaded: true, exports: fakeDb };

const app = require('../server.js');
const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const AUTH = { Authorization: 'Bearer ' + token };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

let server;
let base;
test.before(() => { server = app.listen(0); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => server.close());

const call = async (url, options) => {
    const res = await fetch(base + url, options);
    return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
};

test('GET /api/health trả 200', async () => {
    assert.equal((await call('/api/health')).status, 200);
});

test('API admin từ chối khi chưa đăng nhập', async () => {
    for (const url of ['/api/orders', '/api/dashboard/stats', '/api/products/admin', '/api/bookings']) {
        assert.equal((await call(url)).status, 401, url);
    }
});

test('Đăng nhập sai bị từ chối', async () => {
    const res = await call('/api/auth/login', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email: 'x@x.vn', password: 'sai' }) });
    assert.ok([400, 401].includes(res.status));
});

test('Dashboard trả đủ 5 chỉ số', async () => {
    const res = await call('/api/dashboard/stats', { headers: AUTH });
    assert.deepEqual(res.body, { totalTables: 8, occupiedTables: 2, reservedTables: 1, pendingBookings: 3, completedOrders: 5 });
});

test('Danh sách đơn có phân trang và số liệu tổng', async () => {
    const res = await call('/api/orders?page=2&limit=20&status=confirmed,preparing', { headers: AUTH });
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 45);
    assert.equal(res.body.total_pages, 3);
    assert.equal(res.body.page, 2);
    assert.equal(res.body.summary.awaiting_payment, 4);
    const q = calls.filter((c) => /AS item_count/.test(c.sql)).pop();
    assert.deepEqual(q.params.slice(0, 2), ['confirmed', 'preparing']);
    assert.deepEqual(q.params.slice(-2), [20, 20]); // LIMIT 20 OFFSET 20
});

test('Bộ lọc không hợp lệ bị từ chối', async () => {
    assert.equal((await call('/api/orders?status=abc', { headers: AUTH })).status, 400);
    assert.equal((await call('/api/orders?invoice_status=abc', { headers: AUTH })).status, 400);
    assert.equal((await call('/api/orders?date_from=hôm-qua', { headers: AUTH })).status, 400);
});

test('Tạo đơn: thêm tất cả món bằng 1 câu INSERT', async () => {
    calls.length = 0;
    const body = {
        customer_name: 'Khôi', customer_phone: '0901234567', order_type: 'at_table', table_code: 't01', payment_method: 'cash',
        items: [{ product_id: 1, quantity: 2, size: 'L', toppings: ['Trân châu'] }, { product_id: 1, quantity: 1 }],
    };
    const res = await call('/api/orders', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.items.length, 2);
    assert.equal(calls.filter((c) => /INSERT INTO order_items/.test(c.sql)).length, 1);
    assert.ok(calls.some((c) => c.kind === 'commit'));
});

test('Tạo đơn: dữ liệu sai bị từ chối', async () => {
    const send = (body) => call('/api/orders', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
    assert.equal((await send({})).status, 400);
    assert.equal((await send({ customer_name: 'A', customer_phone: '123' })).status, 400);
});

test('Đặt bàn: dữ liệu sai bị từ chối', async () => {
    const res = await call('/api/bookings', { method: 'POST', headers: JSON_HEADERS, body: '{}' });
    assert.equal(res.status, 400);
});

test('Không lộ file nhạy cảm', async () => {
    for (const url of ['/.env', '/server.js', '/config/db.js', '/assets/../server.js']) {
        const res = await fetch(base + url);
        assert.ok([403, 404].includes(res.status), url + ' => ' + res.status);
    }
});

test('Trang chủ và trang tĩnh tải được, có header bảo mật', async () => {
    const home = await fetch(base + '/');
    assert.equal(home.status, 200);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await fetch(base + '/pages/menu.html')).status, 200);
    assert.equal((await fetch(base + '/admin/login.html')).status, 200);
});

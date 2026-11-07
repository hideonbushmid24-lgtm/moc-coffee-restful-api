// Các ca bảo mật độc lập, không cần MySQL thật.
process.env.JWT_SECRET = 'chuoi-bi-mat-dung-de-test-'.padEnd(40, 'x');
process.env.AUTH_CACHE_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

let currentRole = 'customer';
const fakeUser = () => ({
    id: 9,
    full_name: 'Khách kiểm thử',
    email: 'customer@example.com',
    role: currentRole,
    status: 1,
});
const fakeDb = {
    execute: async (sql) => (/FROM users/.test(sql) ? [[fakeUser()]] : [[]]),
    query: async () => [[]],
    getConnection: async () => ({
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release() {},
        execute: async () => [[]],
        query: async () => [[]],
    }),
    end: async () => {},
};

const dbFile = require.resolve('../config/db.js');
require.cache[dbFile] = {
    id: dbFile,
    filename: dbFile,
    loaded: true,
    exports: fakeDb,
};

const app = require('../server.js');
let server;
let baseUrl;

test.before(() => {
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

async function request(path, options) {
    const response = await fetch(baseUrl + path, options);
    return {
        status: response.status,
        body: await response.json().catch(() => null),
    };
}

test('JWT sai và JWT hết hạn đều bị từ chối', async () => {
    const invalid = await request('/api/admin/me', {
        headers: { Authorization: 'Bearer token-khong-hop-le' },
    });
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.code, 'TOKEN_INVALID');

    const expiredToken = jwt.sign(
        { id: 9 },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: -1 }
    );
    const expired = await request('/api/admin/me', {
        headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(expired.status, 401);
    assert.equal(expired.body.code, 'TOKEN_EXPIRED');
});

test('JWT không có thời hạn bị từ chối', async () => {
    const token = jwt.sign(
        { id: 9 },
        process.env.JWT_SECRET,
        { algorithm: 'HS256' }
    );
    const response = await request('/api/admin/me', {
        headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'TOKEN_INVALID');
});

test('Quyền admin trong token không thể ghi đè role customer trong database', async () => {
    currentRole = 'customer';
    const token = jwt.sign(
        { id: 9, role: 'admin' },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
    );
    const response = await request('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
});

test('JSON hỏng được trả về 400 thay vì làm server lỗi', async () => {
    const response = await request('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"customer_name":',
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message, /JSON/i);
});

test('API không tồn tại trả JSON 404 ổn định', async () => {
    const response = await request('/api/khong-ton-tai');
    assert.equal(response.status, 404);
    assert.match(response.body.message, /không tìm thấy/i);
});

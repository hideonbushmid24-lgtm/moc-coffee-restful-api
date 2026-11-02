/* Xác thực JWT phía giao diện admin. Nạp trong <head> để chuyển hướng trước khi trang hiển thị. */
(function () {
    'use strict';

    var KEY = 'mocCoffeeAdminToken';

    function getToken() {
        try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }
    function setToken(t) {
        try { localStorage.setItem(KEY, t); } catch (e) { /* bỏ qua */ }
    }
    function clearToken() {
        try { localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ }
    }
    function decode(t) {
        try {
            return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        } catch (e) { return null; }
    }
    // Chỉ kiểm tra nhanh hạn token để chuyển hướng cho tiện; server mới là nơi xác thực thật sự.
    function isValid(t) {
        if (!t) return false;
        var p = decode(t);
        if (!p) return false;
        return !(p.exp && p.exp * 1000 < Date.now());
    }
    function toLogin(reason) {
        clearToken();
        location.href = 'login.html' + (reason ? '?' + reason + '=1' : '');
    }

    var onLoginPage = /login\.html$/.test(location.pathname);
    if (!onLoginPage && !isValid(getToken())) {
        toLogin(getToken() ? 'expired' : 'required');
    }

    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function toast(message, type) {
        var el = document.getElementById('admin-toast');
        var msg = document.getElementById('admin-toast-message');
        var icon = document.getElementById('admin-toast-icon');
        if (el && msg && window.bootstrap) {
            msg.textContent = message;
            if (icon) {
                icon.className = type === 'error'
                    ? 'bi bi-x-circle-fill text-danger me-2'
                    : 'bi bi-check-circle-fill text-success me-2';
            }
            window.bootstrap.Toast.getOrCreateInstance(el).show();
        } else {
            alert(message);
        }
    }

    // fetch kèm Bearer token; 401 => về trang đăng nhập
    async function api(url, options) {
        options = options || {};
        var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
        var token = getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;

        var res = await fetch(url, Object.assign({}, options, { headers: headers }));
        var data = null;
        try { data = await res.json(); } catch (e) { /* không có JSON */ }

        if (res.status === 401 && !onLoginPage) {
            toLogin(data && data.code === 'TOKEN_EXPIRED' ? 'expired' : 'required');
            throw new Error('Phiên đăng nhập không hợp lệ');
        }
        if (!res.ok) {
            throw new Error((data && data.message) || 'Yêu cầu thất bại (' + res.status + ')');
        }
        return data;
    }

    // Thay phần tử bằng bản sao để gỡ các handler cũ (nếu admin.js đã gắn dữ liệu mẫu) rồi trả về phần tử mới.
    function fresh(id) {
        var el = document.getElementById(id);
        if (!el) return null;
        var clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);
        return clone;
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('a[href="login.html"]').forEach(function (a) {
            a.addEventListener('click', clearToken);
        });
    });

    window.AdminAuth = {
        getToken: getToken, setToken: setToken, clearToken: clearToken,
        isValid: isValid, api: api, esc: esc, toast: toast, fresh: fresh
    };
})();

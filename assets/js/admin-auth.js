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

    function setBadge(badge, value) {
        if (!badge) return;
        var count = Math.max(0, Number(value) || 0);
        badge.textContent = count;
        badge.classList.toggle('d-none', count === 0);
    }

    function updateSidebarBadges(stats, orderSummary) {
        document.querySelectorAll('.admin-menu a[href="bookings.html"] .badge')
            .forEach(function (badge) {
                setBadge(badge, stats.pendingBookings);
            });

        var openOrders =
            Number(orderSummary.pending_orders || 0) +
            Number(orderSummary.preparing_orders || 0) +
            Number(orderSummary.ready_orders || 0);

        document.querySelectorAll('.admin-menu a[href="orders.html"] .badge')
            .forEach(function (badge) {
                setBadge(badge, openOrders);
            });
    }

    function renderNotifications(stats) {
        var menu = document.querySelector('.admin-notifications');
        if (!menu) return;
        menu.classList.remove('d-none');

        var items = [];

        (stats.upcomingBookings || []).forEach(function (booking) {
            items.push({
                href: 'bookings.html',
                title: 'Đặt bàn ' + (booking.tableCode || ''),
                detail: (booking.customerName || 'Khách hàng') +
                    ' · ' + String(booking.bookingTime || '').slice(0, 5),
            });
        });

        (stats.recentOrders || []).forEach(function (order) {
            if (order.status === 'completed' || order.status === 'cancelled') return;
            items.push({
                href: 'orders.html',
                title: 'Đơn hàng ' + (order.orderCode || ''),
                detail: order.orderType === 'takeaway'
                    ? 'Đơn mang đi'
                    : 'Bàn ' + (order.tableCode || 'chưa chọn'),
            });
        });

        items = items.slice(0, 5);
        menu.innerHTML = '<li><h6 class="dropdown-header">Thông báo mới</h6></li>' +
            (items.length
                ? items.map(function (item) {
                    return '<li><a class="dropdown-item" href="' + esc(item.href) + '">' +
                        '<strong>' + esc(item.title) + '</strong>' +
                        '<small class="d-block text-secondary">' + esc(item.detail) + '</small>' +
                        '</a></li>';
                }).join('')
                : '<li><span class="dropdown-item-text text-secondary">Chưa có thông báo mới.</span></li>');

        var dropdown = menu.closest('.dropdown');
        setBadge(dropdown && dropdown.querySelector('button .badge'), items.length);
    }

    var loadingSharedAdminData = false;

    async function loadSharedAdminData(options) {
        if (onLoginPage || loadingSharedAdminData) return;
        loadingSharedAdminData = true;
        var silent = Boolean(options && options.silent);

        var menus = document.querySelectorAll('.admin-notifications');
        if (!silent) {
            menus.forEach(function (menu) {
                menu.innerHTML = '<li><span class="dropdown-item-text text-secondary">Đang tải thông báo...</span></li>';
                var dropdown = menu.closest('.dropdown');
                var badge = dropdown && dropdown.querySelector('button .badge');
                if (badge) badge.classList.add('d-none');
            });

            document.querySelectorAll('.admin-menu a[href="bookings.html"] .badge, .admin-menu a[href="orders.html"] .badge')
                .forEach(function (badge) { badge.classList.add('d-none'); });
        }

        try {
            var results = await Promise.all([
                api('/api/dashboard/stats?period=7-days'),
                api('/api/orders?page=1&limit=1'),
            ]);
            updateSidebarBadges(results[0], results[1].summary || {});
            renderNotifications(results[0]);
        } catch (error) {
            if (!silent) {
                menus.forEach(function (menu) {
                    menu.classList.remove('d-none');
                    menu.innerHTML = '<li><span class="dropdown-item-text text-danger">Không tải được thông báo.</span></li>';
                });
            }
            console.error('Lỗi tải dữ liệu chung trang admin:', error);
        } finally {
            loadingSharedAdminData = false;
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('a[href="login.html"]').forEach(function (a) {
            a.addEventListener('click', clearToken);
        });
        loadSharedAdminData();

        // Thông báo và badge phải theo dữ liệu mới mà không buộc admin tải lại trang.
        window.setInterval(function () {
            if (!document.hidden) loadSharedAdminData({ silent: true });
        }, 60000);

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) loadSharedAdminData({ silent: true });
        });
    });

    window.AdminAuth = {
        getToken: getToken, setToken: setToken, clearToken: clearToken,
        isValid: isValid, api: api, esc: esc, toast: toast, fresh: fresh
    };
})();

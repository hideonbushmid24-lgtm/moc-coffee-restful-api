/* Trang admin/orders.html: tải, lọc, xem chi tiết, đổi trạng thái, xác nhận thanh toán và hủy đơn qua API. */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';
    var A = window.AdminAuth;

    // Trạng thái xử lý đơn (khớp ENUM orders.status trong database)
    var STATUS = {
        pending: { text: 'Đơn mới', cls: 'danger' },
        confirmed: { text: 'Đã xác nhận', cls: 'primary' },
        preparing: { text: 'Đang chế biến', cls: 'warning' },
        ready: { text: 'Sẵn sàng phục vụ', cls: 'info' },
        completed: { text: 'Hoàn thành', cls: 'success' },
        cancelled: { text: 'Đã hủy', cls: 'secondary' }
    };
    // Bước tiếp theo hợp lệ (giống NEXT_STATUSES ở server; server vẫn kiểm tra lại)
    var NEXT = {
        pending: { to: 'confirmed', label: 'Xác nhận đơn' },
        confirmed: { to: 'preparing', label: 'Bắt đầu chế biến' },
        preparing: { to: 'ready', label: 'Sẵn sàng phục vụ' },
        ready: { to: 'completed', label: 'Hoàn thành đơn' }
    };
    var PAY = {
        pending: { text: 'Chưa thanh toán', cls: 'secondary' },
        pending_verification: { text: 'Chờ xác nhận CK', cls: 'info' },
        paid: { text: 'Đã thanh toán', cls: 'success' },
        failed: { text: 'Thất bại', cls: 'danger' },
        refunded: { text: 'Đã hoàn tiền', cls: 'dark' }
    };
    // Nhóm trạng thái dùng cho tab và ô lọc (giá trị bên trái là data-status/value trong HTML)
    var GROUPS = {
        'new': ['pending'],
        preparing: ['confirmed', 'preparing'],
        ready: ['ready'],
        completed: ['completed'],
        cancelled: ['cancelled']
    };

    var tbody = document.getElementById('order-table-body');
    var emptyBox = document.getElementById('empty-order-result');
    var search = A.fresh('order-search-input');
    var dateFilter = A.fresh('order-date-filter');
    var typeFilter = A.fresh('order-type-filter');
    var statusFilter = A.fresh('order-status-filter');
    var sortSelect = A.fresh('order-sort');
    var resetBtn = A.fresh('reset-order-filter');
    var refreshBtn = A.fresh('refresh-orders-button');
    var nextBtn = A.fresh('detail-next-status-button');
    var detailPaymentBtn = A.fresh('detail-confirm-payment-button');
    var tabsBox = document.getElementById('order-status-tabs');
    var activeTab = 'all';
    var PAGE_SIZE = 20;
    var page = 1;
    var loadSeq = 0; // chống kết quả cũ về sau ghi đè kết quả mới
    var searchTimer = null;
    var detailOrder = null;

    // Xóa các hàng dữ liệu mẫu trong HTML để không hiện số liệu giả khi chưa tải được dữ liệu thật
    function showMessage(text, cls) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center ' + cls + ' py-4">' + text + '</td></tr>';
    }
    showMessage('Đang tải...', 'text-secondary');

    // ----- Dọn phần giao diện mẫu không còn phù hợp -----
    var createBtn = document.getElementById('open-create-order-button');
    if (createBtn) createBtn.remove(); // khách tự gọi món; admin chỉ xử lý đơn
    if (statusFilter) {
        Array.prototype.slice.call(statusFilter.options).forEach(function (o) {
            if (o.value === 'served') o.remove(); // database không có trạng thái "đã phục vụ"
        });
    }
    var footer = document.querySelector('.card-footer'); // khối phân trang, được AdminPager vẽ lại
    var detailModalEl = document.getElementById('order-detail-modal');
    if (detailModalEl) {
        // Bảng món trong API không có cột trạng thái từng món
        Array.prototype.slice.call(detailModalEl.querySelectorAll('thead th')).forEach(function (th) {
            if (th.textContent.trim() === 'Trạng thái') th.remove();
        });
    }

    // ----- Hàm hỗ trợ -----
    function pad(n) { return String(n).padStart(2, '0'); }
    function money(v) {
        return new Intl.NumberFormat('vi-VN').format(Number(v) || 0) + ' ₫';
    }
    function fmt(v) {
        var d = new Date(v);
        if (isNaN(d)) return { date: '—', time: '' };
        return {
            date: pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(),
            time: pad(d.getHours()) + ':' + pad(d.getMinutes())
        };
    }
    function ymd(v) {
        var d = new Date(v);
        return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function norm(s) {
        return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }
    function setText(id, v) {
        var el = document.getElementById(id);
        if (el) el.textContent = v;
    }
    function badge(map, key) {
        var s = map[key] || { text: key, cls: 'secondary' };
        return '<span class="badge text-bg-' + s.cls + '">' + A.esc(s.text) + '</span>';
    }
    function awaitingPayment(o) {
        return (o.payment_status === 'pending' || o.payment_status === 'pending_verification') && o.status !== 'cancelled';
    }
    function canCancel(o) {
        return o.status !== 'completed' && o.status !== 'cancelled' && o.payment_status !== 'paid';
    }

    // ----- Hiển thị danh sách -----
    function actions(o) {
        var id = A.esc(o.id);
        var btn = function (act, cls, label) {
            return '<button type="button" class="btn btn-sm btn-outline-' + cls + ' me-1 mb-1" data-act="' + act + '" data-id="' + id + '">' + label + '</button>';
        };
        var html = btn('view', 'secondary', 'Xem');
        if (NEXT[o.status]) html += btn('status:' + NEXT[o.status].to, 'primary', NEXT[o.status].label);
        if (awaitingPayment(o)) html += btn('pay', 'success', 'Đã thanh toán');
        if (canCancel(o)) html += btn('status:cancelled', 'danger', 'Hủy');
        return html;
    }

    function row(o) {
        var t = fmt(o.created_at);
        var where = o.order_type === 'at_table'
            ? '<strong>' + A.esc(o.table_code || 'Chưa có bàn') + '</strong><small class="d-block text-secondary">Dùng tại bàn</small>'
            : '<strong>Mang đi</strong><small class="d-block text-secondary">&nbsp;</small>';
        return '<tr class="order-row">' +
            '<td class="ps-4"><strong>' + A.esc(o.order_code) + '</strong></td>' +
            '<td>' + where + '</td>' +
            '<td><strong>' + A.esc(o.customer_name) + '</strong><small class="d-block text-secondary">' + A.esc(o.customer_phone) + '</small></td>' +
            '<td><strong>' + t.date + '</strong><small class="d-block text-secondary">' + t.time + '</small></td>' +
            '<td>' + A.esc(o.item_count) + ' món</td>' +
            '<td><strong>' + money(o.total_amount) + '</strong><small class="d-block text-secondary">' + A.esc(o.payment_method_text) + '</small></td>' +
            '<td>' + badge(STATUS, o.status) + '<div class="mt-1">' + badge(PAY, o.payment_status) + '</div></td>' +
            '<td class="text-center pe-4">' + actions(o) + '</td></tr>';
    }

    // Nhóm trạng thái -> danh sách status gửi lên server (null = không lọc)
    function groupStatuses(key) {
        if (!key || key === 'all' || key === 'payment') return null;
        return GROUPS[key] || null;
    }

    // Ghép điều kiện của tab đang chọn và ô lọc "Trạng thái" thành tham số cho API
    function buildQuery() {
        var q = new URLSearchParams();
        q.set('page', page);
        q.set('limit', PAGE_SIZE);

        var st = statusFilter && statusFilter.value;
        var a = groupStatuses(activeTab);
        var b = groupStatuses(st);
        var statuses = a && b ? a.filter(function (x) { return b.indexOf(x) !== -1; }) : (a || b);
        if (statuses && !statuses.length) return null; // tab và ô lọc loại trừ nhau => chắc chắn không có đơn nào
        if (statuses) q.set('status', statuses.join(','));
        if (activeTab === 'payment' || st === 'payment') q.set('awaiting_payment', '1');

        var type = typeFilter && typeFilter.value;
        if (type && type !== 'all') q.set('order_type', type.replace('-', '_'));
        if (dateFilter && dateFilter.value) q.set('date', dateFilter.value);
        var keyword = search && search.value.trim();
        if (keyword) q.set('q', keyword);
        var sort = sortSelect && sortSelect.value;
        if (sort) q.set('sort', sort.replace('-', '_'));
        return q.toString();
    }

    function render(list, total) {
        tbody.innerHTML = list.map(row).join('');
        setText('visible-order-count', total);
        if (emptyBox) emptyBox.classList.toggle('d-none', list.length > 0);
    }

    // Số trên các tab lấy từ server (đếm trên TẤT CẢ đơn, không chỉ trang đang xem)
    function updateTabCounts(s) {
        if (!tabsBox) return;
        var counts = {
            all: s.all_orders, 'new': s.pending_orders, preparing: s.preparing_orders,
            ready: s.ready_orders, payment: s.awaiting_payment, completed: s.completed_orders,
            cancelled: s.cancelled_orders
        };
        Array.prototype.slice.call(tabsBox.querySelectorAll('.order-status-tab')).forEach(function (tab) {
            var b = tab.querySelector('.badge');
            if (b) b.textContent = counts[tab.dataset.status] || 0;
        });
    }

    async function load() {
        var seq = ++loadSeq;
        try {
            var query = buildQuery();
            var res = query === null
                ? { data: [], total: 0, total_pages: 1, summary: {} }
                : await A.api('/api/orders?' + query);
            if (seq !== loadSeq) return;
            var s = res.summary;
            if (s && s.all_orders !== undefined) { // không có summary khi tab và ô lọc loại trừ nhau
                setText('today-order-count', s.today_orders || 0);
                setText('new-order-count', s.pending_orders || 0);
                setText('preparing-order-count', s.preparing_orders || 0);
                setText('payment-order-count', s.awaiting_payment || 0);
                updateTabCounts(s);
            }
            render(res.data || [], res.total || 0);
            if (page > res.total_pages) { page = res.total_pages; return load(); } // trang hiện tại không còn (vd vừa hủy đơn cuối)
            window.AdminPager.render(footer, {
                page: page, totalPages: res.total_pages || 1, total: res.total || 0,
                limit: PAGE_SIZE, noun: 'đơn hàng',
                onChange: function (p) { page = p; load(); }
            });
        } catch (err) {
            if (seq !== loadSeq) return;
            console.error('Lỗi tải danh sách đơn hàng:', err);
            showMessage('Không tải được đơn hàng. Vui lòng thử lại.', 'text-danger');
            A.toast(err.message, 'error');
        }
    }

    // Đổi bộ lọc thì về trang 1 và hỏi lại server
    function reload() { page = 1; load(); }

        /* Tiến trình đơn hàng: tô màu các bước theo trạng thái đơn + thanh toán */
    function renderTimeline(o, created) {
        var items = document.querySelectorAll('.order-timeline .order-timeline-item');
        if (items.length < 4) return;
        var cancelled = o.status === 'cancelled';
        var cooking = ['preparing', 'ready', 'completed'].indexOf(o.status) !== -1;
        var served = ['ready', 'completed'].indexOf(o.status) !== -1;
        var paid = o.payment_status === 'paid';
        var payNote = paid ? 'Đã xác nhận thanh toán'
            : o.payment_status === 'pending_verification' ? 'Chờ xác nhận thanh toán'
            : o.payment_status === 'failed' ? 'Thanh toán thất bại'
            : o.payment_status === 'refunded' ? 'Đã hoàn tiền' : 'Chưa cập nhật';
        var steps = [
            { done: true, note: created.time + ' ' + created.date + (cancelled ? ' · Đơn đã hủy' : '') },
            { done: cooking, note: o.status === 'preparing' ? 'Đang thực hiện' : cooking ? 'Hoàn tất' : 'Chưa cập nhật' },
            { done: served, note: o.status === 'completed' ? 'Đã phục vụ' : served ? 'Sẵn sàng phục vụ' : 'Chưa cập nhật' },
            { done: paid, note: payNote }
        ];
        steps.forEach(function (s, i) {
            items[i].classList.toggle('completed', s.done);
            var small = items[i].querySelector('small');
            if (small) small.textContent = s.note;
        });
    }

    // ----- Chi tiết đơn -----
    function fillDetail(o) {
        detailOrder = o;
        var st = STATUS[o.status] || { text: o.status, cls: 'secondary' };
        setText('detail-order-id', o.order_code);
        var badgeEl = document.getElementById('detail-order-status');
        if (badgeEl) {
            badgeEl.className = 'badge text-bg-' + st.cls + ' mt-2 mt-sm-0';
            badgeEl.textContent = st.text + ' · ' + (PAY[o.payment_status] ? PAY[o.payment_status].text : o.payment_status);
        }
        var t = fmt(o.created_at);
        setText('detail-order-customer', o.customer_name);
        setText('detail-order-phone', o.customer_phone);
        setText('detail-order-table', o.order_type === 'at_table' ? (o.table_code || 'Chưa có bàn') : 'Mang đi');
        setText('detail-order-time', t.time + ' ' + t.date);
        setText('detail-order-note', o.note || 'Không có ghi chú');
        setText('detail-order-subtotal', money(o.subtotal));
        setText('detail-order-discount', '-' + money(o.discount_amount));
        setText('detail-order-service-fee', money(o.service_fee));
        setText('detail-order-total', money(o.total_amount));
        renderTimeline(o, t);

        var body = document.getElementById('detail-order-items');
        if (body) {
            body.innerHTML = (o.items || []).map(function (it) {
                var opts = [];
                if (it.size) opts.push('Size ' + it.size);
                if (it.sugar_level) opts.push(it.sugar_level + ' đường');
                if (it.ice_level) opts.push(it.ice_level + ' đá');
                if (it.toppings && it.toppings.length) {
                    opts.push(it.toppings.map(function (x) { return typeof x === 'string' ? x : (x.name || ''); }).filter(Boolean).join(', '));
                }
                if (it.note) opts.push('Ghi chú: ' + it.note);
                return '<tr><td><strong>' + A.esc(it.product_name) + '</strong>' +
                    (opts.length ? '<small class="d-block text-secondary">' + A.esc(opts.join(' · ')) + '</small>' : '') + '</td>' +
                    '<td class="text-center">' + A.esc(it.quantity) + '</td>' +
                    '<td class="text-end">' + money(it.unit_price) + '</td>' +
                    '<td class="text-end">' + money(it.line_total) + '</td></tr>';
            }).join('');
        }
        if (nextBtn) {
            var n = NEXT[o.status];
            nextBtn.disabled = false;
            nextBtn.classList.toggle('d-none', !n);
            if (n) nextBtn.lastChild.textContent = ' ' + n.label;
        }
        if (detailPaymentBtn) {
            detailPaymentBtn.disabled = false;
            detailPaymentBtn.classList.toggle('d-none', !awaitingPayment(o));
        }
    }

    async function openDetail(id) {
        try {
            var res = await A.api('/api/orders/' + encodeURIComponent(id));
            fillDetail(res.data);
            if (detailModalEl && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(detailModalEl).show();
        } catch (err) {
            A.toast(err.message, 'error');
        }
    }

    // ----- Gọi API đổi trạng thái / thanh toán -----
    async function changeStatus(id, status, btn) {
        if (status === 'cancelled' && !confirm('Bạn chắc chắn muốn hủy đơn này?')) return false;
        if (btn) btn.disabled = true;
        try {
            var res = await A.api('/api/orders/' + encodeURIComponent(id) + '/status', {
                method: 'PATCH',
                body: JSON.stringify({ status: status })
            });
            A.toast(res.message);
            await load();
            return true;
        } catch (err) {
            A.toast(err.message, 'error');
            if (btn) btn.disabled = false;
            return false;
        }
    }

    async function confirmPayment(id, btn) {
        if (!confirm('Xác nhận khách đã thanh toán đơn này?')) return false;
        if (btn) btn.disabled = true;
        try {
            var res = await A.api('/api/orders/' + encodeURIComponent(id) + '/payment', { method: 'PATCH' });
            A.toast(res.message);
            await load();
            return true;
        } catch (err) {
            A.toast(err.message, 'error');
            if (btn) btn.disabled = false;
            return false;
        }
    }

    // ----- Sự kiện -----
    tbody.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var act = btn.dataset.act;
        if (act === 'view') return openDetail(btn.dataset.id);
        if (act === 'pay') return confirmPayment(btn.dataset.id, btn);
        if (act.indexOf('status:') === 0) return changeStatus(btn.dataset.id, act.slice(7), btn);
    });

    if (nextBtn) nextBtn.addEventListener('click', async function () {
        if (!detailOrder || !NEXT[detailOrder.status]) return;
        var id = detailOrder.id;
        if (await changeStatus(id, NEXT[detailOrder.status].to, nextBtn)) {
            var res = await A.api('/api/orders/' + encodeURIComponent(id));
            fillDetail(res.data); // cập nhật lại nội dung đang mở
        }
    });

    if (detailPaymentBtn) detailPaymentBtn.addEventListener('click', async function () {
        if (!detailOrder || !awaitingPayment(detailOrder)) return;
        var id = detailOrder.id;
        if (await confirmPayment(id, detailPaymentBtn)) {
            var res = await A.api('/api/orders/' + encodeURIComponent(id));
            fillDetail(res.data);
        }
    });

    if (tabsBox) tabsBox.addEventListener('click', function (e) {
        var tab = e.target.closest('.order-status-tab');
        if (!tab) return;
        activeTab = tab.dataset.status;
        Array.prototype.slice.call(tabsBox.querySelectorAll('.order-status-tab')).forEach(function (t) {
            t.classList.toggle('active', t === tab);
        });
        reload();
    });

    [dateFilter, typeFilter, statusFilter, sortSelect].forEach(function (el) {
        if (el) el.addEventListener('change', reload);
    });
    // Ô tìm kiếm: chờ người dùng ngừng gõ 300ms rồi mới gọi API
    if (search) search.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(reload, 300);
    });
    if (resetBtn) resetBtn.addEventListener('click', function () {
        if (search) search.value = '';
        if (dateFilter) dateFilter.value = '';
        if (typeFilter) typeFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'newest';
        activeTab = 'all';
        if (tabsBox) Array.prototype.slice.call(tabsBox.querySelectorAll('.order-status-tab')).forEach(function (t) {
            t.classList.toggle('active', t.dataset.status === 'all');
        });
        reload();
    });
    if (refreshBtn) refreshBtn.addEventListener('click', load);

    load();
});

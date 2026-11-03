/* Trang admin/invoices.html: hóa đơn được tạo từ đơn hàng (không có bảng invoices riêng).
   Mỗi đơn = một hóa đơn; "xác nhận thanh toán" gọi PATCH /api/orders/:id/payment. */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';
    var A = window.AdminAuth;

    var STATUS = {
        pending: { text: 'Chờ thanh toán', cls: 'warning' },
        paid: { text: 'Đã thanh toán', cls: 'success' },
        cancelled: { text: 'Đã hủy', cls: 'danger' },
        failed: { text: 'Thất bại', cls: 'danger' },
        refunded: { text: 'Đã hoàn tiền', cls: 'dark' }
    };

    var tbody = document.getElementById('invoice-table-body');
    var emptyBox = document.getElementById('empty-invoice-result');
    var search = A.fresh('invoice-search-input');
    var dateFrom = A.fresh('invoice-date-from');
    var dateTo = A.fresh('invoice-date-to');
    var methodFilter = A.fresh('payment-method-filter');
    var statusFilter = A.fresh('invoice-status-filter');
    var sortSelect = A.fresh('invoice-sort');
    var resetBtn = A.fresh('reset-invoice-filter');
    var all = [];

    // ----- Dọn phần giao diện mẫu không còn phù hợp -----
    var createBtn = document.getElementById('open-create-invoice-button');
    if (createBtn) createBtn.remove(); // hóa đơn sinh tự động từ đơn hàng
    var footer = document.querySelector('.card-footer');
    if (footer && footer.querySelector('.pagination')) footer.remove();

    // ----- Hàm hỗ trợ -----
    function pad(n) { return String(n).padStart(2, '0'); }
    function money(v) { return new Intl.NumberFormat('vi-VN').format(Number(v) || 0) + ' ₫'; }
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
    function code(o) { return 'HD' + String(o.id).padStart(4, '0'); }
    // Trạng thái hóa đơn suy ra từ đơn: đơn hủy => "Đã hủy", còn lại theo payment_status
    function invStatus(o) {
        if (o.status === 'cancelled') return 'cancelled';
        if (o.payment_status === 'paid') return 'paid';
        if (o.payment_status === 'failed' || o.payment_status === 'refunded') return o.payment_status;
        return 'pending'; // pending, pending_verification
    }
    function badge(key) {
        var s = STATUS[key] || { text: key, cls: 'secondary' };
        return '<span class="badge text-bg-' + s.cls + '">' + A.esc(s.text) + '</span>';
    }

    // ----- Hiển thị danh sách -----
    function actions(o) {
        var id = A.esc(o.id);
        var btn = function (act, cls, label) {
            return '<button type="button" class="btn btn-sm btn-outline-' + cls + ' me-1 mb-1" data-act="' + act + '" data-id="' + id + '">' + label + '</button>';
        };
        var html = btn('view', 'secondary', 'Xem');
        if (invStatus(o) === 'pending') html += btn('pay', 'success', 'Xác nhận thanh toán');
        return html;
    }

    function row(o) {
        var t = fmt(o.created_at);
        return '<tr class="invoice-row">' +
            '<td class="ps-4"><strong>' + code(o) + '</strong></td>' +
            '<td>' + A.esc(o.order_code) + '</td>' +
            '<td><strong>' + A.esc(o.customer_name) + '</strong><small class="d-block text-secondary">' + A.esc(o.customer_phone) + '</small></td>' +
            '<td><strong>' + t.date + '</strong><small class="d-block text-secondary">' + t.time + '</small></td>' +
            '<td>' + A.esc(o.payment_method_text) + '</td>' +
            '<td><strong>' + money(o.total_amount) + '</strong></td>' +
            '<td>' + badge(invStatus(o)) + '</td>' +
            '<td class="text-center pe-4">' + actions(o) + '</td></tr>';
    }

    function filtered() {
        var q = norm(search && search.value).trim();
        var from = dateFrom && dateFrom.value;
        var to = dateTo && dateTo.value;
        var method = methodFilter && methodFilter.value;
        var st = statusFilter && statusFilter.value;
        var list = all.filter(function (o) {
            var d = ymd(o.created_at);
            if (st && st !== 'all' && invStatus(o) !== st) return false;
            if (method && method !== 'all' && o.payment_method !== method.replace('-', '_')) return false;
            if (from && d < from) return false;
            if (to && d > to) return false;
            if (q && norm([code(o), o.order_code, o.customer_name, o.customer_phone].join(' ')).indexOf(q) === -1) return false;
            return true;
        });
        var sort = sortSelect && sortSelect.value;
        list.sort(function (a, b) {
            if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
            if (sort === 'amount-desc') return b.total_amount - a.total_amount;
            if (sort === 'amount-asc') return a.total_amount - b.total_amount;
            return new Date(b.created_at) - new Date(a.created_at);
        });
        return list;
    }

    function render() {
        var list = filtered();
        tbody.innerHTML = list.map(row).join('');
        setText('visible-invoice-count', list.length);
        if (emptyBox) emptyBox.classList.toggle('d-none', list.length > 0);
    }

    function stats() {
        var today = ymd(new Date());
        var todays = all.filter(function (o) { return ymd(o.created_at) === today; });
        var revenue = todays.filter(function (o) { return invStatus(o) === 'paid'; })
            .reduce(function (sum, o) { return sum + o.total_amount; }, 0);
        setText('today-revenue', money(revenue));
        setText('today-invoice-count', todays.filter(function (o) { return o.status !== 'cancelled'; }).length);
        setText('pending-invoice-count', all.filter(function (o) { return invStatus(o) === 'pending'; }).length);
        setText('paid-invoice-count', all.filter(function (o) { return invStatus(o) === 'paid'; }).length);
    }

    async function load() {
        try {
            var res = await A.api('/api/orders?limit=200');
            all = res.data || [];
            stats();
            render();
        } catch (err) {
            console.error('Lỗi tải danh sách hóa đơn:', err);
            A.toast(err.message, 'error');
        }
    }

    // ----- Chi tiết hóa đơn -----
    async function openDetail(id) {
        try {
            var res = await A.api('/api/orders/' + encodeURIComponent(id));
            var o = res.data;
            var t = fmt(o.created_at);
            setText('detail-invoice-id', code(o));
            setText('detail-order-id', o.order_code);
            setText('detail-invoice-customer', o.customer_name + ' · ' + o.customer_phone);
            setText('detail-invoice-table', o.order_type === 'at_table' ? (o.table_code || 'Chưa có bàn') : 'Mang đi');
            setText('detail-invoice-time', t.time + ' ' + t.date);
            setText('detail-payment-method', o.payment_method_text);
            setText('detail-invoice-subtotal', money(o.subtotal));
            setText('detail-invoice-service-fee', money(o.service_fee));
            setText('detail-invoice-discount', '-' + money(o.discount_amount));
            setText('detail-invoice-total', money(o.total_amount));

            var st = STATUS[invStatus(o)] || { text: '', cls: 'secondary' };
            var badgeEl = document.getElementById('detail-invoice-status');
            if (badgeEl) {
                badgeEl.className = 'badge text-bg-' + st.cls;
                badgeEl.textContent = st.text;
            }
            var body = document.getElementById('detail-invoice-items');
            if (body) {
                body.innerHTML = (o.items || []).map(function (it) {
                    return '<tr><td>' + A.esc(it.product_name) + '</td>' +
                        '<td class="text-center">' + A.esc(it.quantity) + '</td>' +
                        '<td class="text-end">' + money(it.unit_price) + '</td>' +
                        '<td class="text-end">' + money(it.line_total) + '</td></tr>';
                }).join('');
            }
            var modalEl = document.getElementById('invoice-detail-modal');
            if (modalEl && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
        } catch (err) {
            A.toast(err.message, 'error');
        }
    }

    async function confirmPayment(id, btn) {
        if (!confirm('Xác nhận khách đã thanh toán hóa đơn này?')) return;
        btn.disabled = true;
        try {
            var res = await A.api('/api/orders/' + encodeURIComponent(id) + '/payment', { method: 'PATCH' });
            A.toast(res.message);
            await load();
        } catch (err) {
            A.toast(err.message, 'error');
            btn.disabled = false;
        }
    }

    // ----- Sự kiện -----
    tbody.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        if (btn.dataset.act === 'view') return openDetail(btn.dataset.id);
        if (btn.dataset.act === 'pay') return confirmPayment(btn.dataset.id, btn);
    });

    [search, dateFrom, dateTo, methodFilter, statusFilter, sortSelect].forEach(function (el) {
        if (el) { el.addEventListener('input', render); el.addEventListener('change', render); }
    });
    if (resetBtn) resetBtn.addEventListener('click', function () {
        if (search) search.value = '';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (methodFilter) methodFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'newest';
        render();
    });

    load();
});
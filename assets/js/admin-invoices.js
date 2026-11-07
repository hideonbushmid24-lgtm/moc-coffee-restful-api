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
    var PAGE_SIZE = 20;
    var page = 1;
    var loadSeq = 0; // chống kết quả cũ về sau ghi đè kết quả mới
    var searchTimer = null;

    // Xóa các hàng dữ liệu mẫu trong HTML để không hiện số liệu giả khi chưa tải được dữ liệu thật
    function showMessage(text, cls) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center ' + cls + ' py-4">' + text + '</td></tr>';
    }
    showMessage('Đang tải...', 'text-secondary');


    // ----- Dọn phần giao diện mẫu không còn phù hợp -----
    var createBtn = document.getElementById('open-create-invoice-button');
    if (createBtn) createBtn.remove(); // hóa đơn sinh tự động từ đơn hàng
    var footer = document.querySelector('.card-footer'); // khối phân trang, được AdminPager vẽ lại

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
    function resetStats() {
        ['today-revenue', 'today-invoice-count', 'pending-invoice-count', 'paid-invoice-count']
            .forEach(function (id) { setText(id, '—'); });
    }
    resetStats();
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

    function buildQuery() {
        var q = new URLSearchParams();
        q.set('page', page);
        q.set('limit', PAGE_SIZE);
        var st = statusFilter && statusFilter.value;
        if (st && st !== 'all') q.set('invoice_status', st);
        var method = methodFilter && methodFilter.value;
        if (method && method !== 'all') q.set('payment_method', method.replace('-', '_'));
        if (dateFrom && dateFrom.value) q.set('date_from', dateFrom.value);
        if (dateTo && dateTo.value) q.set('date_to', dateTo.value);
        var keyword = search && search.value.trim();
        if (keyword) q.set('q', keyword);
        var sort = sortSelect && sortSelect.value;
        if (sort) q.set('sort', sort.replace('-', '_'));
        return q.toString();
    }

    function render(list, total) {
        tbody.innerHTML = list.map(row).join('');
        setText('visible-invoice-count', total);
        if (emptyBox) emptyBox.classList.toggle('d-none', list.length > 0);
    }

    // Số liệu thẻ thống kê lấy từ server (tính trên tất cả đơn)
    function stats(s) {
        setText('today-revenue', money(s.today_revenue));
        setText('today-invoice-count', s.today_invoices || 0);
        setText('pending-invoice-count', s.awaiting_payment || 0);
        setText('paid-invoice-count', s.paid_invoices || 0);
    }

    async function load() {
        var seq = ++loadSeq;
        try {
            var res = await A.api('/api/orders?' + buildQuery());
            if (seq !== loadSeq) return;
            stats(res.summary || {});
            render(res.data || [], res.total || 0);
            if (page > res.total_pages) { page = res.total_pages; return load(); }
            window.AdminPager.render(footer, {
                page: page, totalPages: res.total_pages || 1, total: res.total || 0,
                limit: PAGE_SIZE, noun: 'hóa đơn',
                onChange: function (p) { page = p; load(); }
            });
        } catch (err) {
            if (seq !== loadSeq) return;
            console.error('Lỗi tải danh sách hóa đơn:', err);
            resetStats();
            showMessage('Không tải được hóa đơn. Vui lòng thử lại.', 'text-danger');
            A.toast(err.message, 'error');
        }
    }

    // Đổi bộ lọc thì về trang 1 và hỏi lại server
    function reload() { page = 1; load(); }

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

    [dateFrom, dateTo, methodFilter, statusFilter, sortSelect].forEach(function (el) {
        if (el) el.addEventListener('change', reload);
    });
    // Ô tìm kiếm: chờ người dùng ngừng gõ 300ms rồi mới gọi API
    if (search) search.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(reload, 300);
    });
    if (resetBtn) resetBtn.addEventListener('click', function () {
        if (search) search.value = '';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (methodFilter) methodFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'newest';
        reload();
    });

    load();
});

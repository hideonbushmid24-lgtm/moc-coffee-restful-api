/* Trang admin/bookings.html: tải, lọc, duyệt và hủy đơn đặt bàn qua API. */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';
    var A = window.AdminAuth;
    var STATUS = {
        pending: { text: 'Chờ xác nhận', cls: 'warning' },
        confirmed: { text: 'Đã xác nhận', cls: 'success' },
        seated: { text: 'Đang phục vụ', cls: 'primary' },
        completed: { text: 'Hoàn thành', cls: 'secondary' },
        cancelled: { text: 'Đã hủy', cls: 'danger' }
    };

    var tbody = document.getElementById('booking-table-body');
    var emptyBox = document.getElementById('empty-booking-result');
    var search = A.fresh('booking-search-input');
    var dateFilter = A.fresh('booking-date-filter');
    var statusFilter = A.fresh('booking-status-filter');
    var resetBtn = A.fresh('reset-booking-filter');
    var all = [];

    function setStat(id, value) {
        var element = document.getElementById(id);
        if (element) element.textContent = value;
    }
    function resetStats() {
        ['today-booking-count', 'pending-booking-count', 'confirmed-booking-count', 'cancelled-booking-count']
            .forEach(function (id) { setStat(id, '—'); });
    }
    resetStats();
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-4">Đang tải...</td></tr>';

    // Dữ liệu API không có khu vực, và chỉ có 3 trạng thái
    var areaSelect = document.getElementById('booking-area-filter');
    if (areaSelect) areaSelect.closest('[class*="col-"]').remove();
    if (statusFilter) {
        Array.prototype.slice.call(statusFilter.options).forEach(function (o) {
            if (o.value !== 'all' && !STATUS[o.value]) o.remove();
        });
    }
    var footer = document.querySelector('.card-footer');
    if (footer) footer.remove(); // phân trang mẫu không còn đúng
    var addBtn = document.getElementById('open-add-booking-button');
    if (addBtn) addBtn.remove(); // khách tự đặt qua form công khai; admin chỉ duyệt/hủy
    var printBtn = document.getElementById('print-booking-button');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

    function pad(n) { return String(n).padStart(2, '0'); }
    function fmt(b) {
        var p = String(b.booking_date || '').split('-');
        if (p.length !== 3) return { date: '—', time: '' };
        return { date: p[2] + '/' + p[1] + '/' + p[0], time: String(b.booking_time || '').slice(0, 5) };
    }
    function ymd(v) {
        var d = new Date(v);
        return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function actions(b) {
        var id = A.esc(b.id);
        var btn = function (act, cls, label) {
            return '<button type="button" class="btn btn-sm btn-outline-' + cls + ' me-1" data-act="' + act + '" data-id="' + id + '">' + label + '</button>';
        };
        // Luồng của API: chờ xác nhận -> đã xác nhận -> đang phục vụ -> hoàn thành (hủy được trước khi nhận khách)
        if (b.status === 'pending') return btn('confirmed', 'success', 'Xác nhận') + btn('cancelled', 'danger', 'Hủy');
        if (b.status === 'confirmed') return btn('seated', 'primary', 'Nhận khách') + btn('cancelled', 'danger', 'Hủy');
        if (b.status === 'seated') return btn('completed', 'success', 'Hoàn thành');
        return '<span class="text-secondary">—</span>';
    }

    function row(b) {
        var st = STATUS[b.status] || { text: b.status, cls: 'secondary' };
        var t = fmt(b);
        return '<tr class="booking-row">' +
            '<td class="ps-4"><strong>#' + A.esc(b.id) + '</strong></td>' +
            '<td><strong>' + A.esc(b.customer_name) + '</strong><small class="d-block text-secondary">' + A.esc(b.phone) + '</small></td>' +
            '<td><strong>' + t.date + '</strong><small class="d-block text-secondary">' + t.time + '</small></td>' +
            '<td>' + (b.table_name ? A.esc(b.table_name) : '<span class="text-secondary">Chưa chọn bàn</span>') + '</td>' +
            '<td>' + A.esc(b.number_of_guests) + ' khách</td>' +
            '<td><span class="badge text-bg-' + st.cls + '">' + st.text + '</span></td>' +
            '<td class="text-center pe-4">' + actions(b) + '</td></tr>';
    }

    function stats() {
        var today = ymd(new Date());
        var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
        set('today-booking-count', all.filter(function (b) { return b.booking_date === today; }).length);
        ['pending', 'confirmed', 'cancelled'].forEach(function (s) {
            set(s + '-booking-count', all.filter(function (b) { return b.status === s; }).length);
        });
    }

    function render() {
        var q = (search && search.value || '').trim().toLowerCase();
        var d = dateFilter && dateFilter.value;
        var s = statusFilter && statusFilter.value;
        var list = all.filter(function (b) {
            if (s && s !== 'all' && b.status !== s) return false;
            if (d && b.booking_date !== d) return false;
            if (q && (String(b.id) + ' ' + b.customer_name + ' ' + b.phone).toLowerCase().indexOf(q) === -1) return false;
            return true;
        });
        tbody.innerHTML = list.map(row).join('');
        var cnt = document.getElementById('visible-booking-count');
        if (cnt) cnt.textContent = list.length;
        if (emptyBox) emptyBox.classList.toggle('d-none', list.length > 0);
    }

    async function load() {
        try {
            all = await A.api('/api/bookings');
            stats();
            render();
        } catch (err) {
            console.error('Lỗi tải danh sách booking:', err);
            resetStats();
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Không tải được danh sách đặt bàn.</td></tr>';
            A.toast(err.message, 'error');
        }
    }

    tbody.addEventListener('click', async function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var status = btn.dataset.act;
        if (status === 'cancelled' && !confirm('Bạn chắc chắn muốn hủy đơn đặt bàn #' + btn.dataset.id + '?')) return;
        btn.disabled = true;
        try {
            var res = await A.api('/api/bookings/' + encodeURIComponent(btn.dataset.id) + '/status', {
                method: 'PATCH',
                body: JSON.stringify({ status: status })
            });
            A.toast(res.message);
            await load();
        } catch (err) {
            A.toast(err.message, 'error');
            btn.disabled = false;
        }
    });

    [search, dateFilter, statusFilter].forEach(function (el) {
        if (el) { el.addEventListener('input', render); el.addEventListener('change', render); }
    });
    if (resetBtn) resetBtn.addEventListener('click', function () {
        if (search) search.value = '';
        if (dateFilter) dateFilter.value = '';
        if (statusFilter) statusFilter.value = 'all';
        render();
    });

        load();

    // Tự làm mới để đơn khách vừa đặt hiện ra mà không cần F5
    setInterval(function () { if (!document.hidden) load(); }, 20000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
});

/* Trang admin/tables.html: sơ đồ bàn lấy từ DB, cập nhật trạng thái qua API. */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';
    var A = window.AdminAuth;
    var STATUS = {
        available: { text: 'Bàn trống', cls: 'available' },
        occupied: { text: 'Đang sử dụng', cls: 'occupied' },
        maintenance: { text: 'Bảo trì', cls: 'maintenance' }
    };
    // Hành động nhanh theo trạng thái hiện tại
    var NEXT = {
        available: [['occupied', 'Nhận khách', 'primary'], ['maintenance', 'Bảo trì', 'secondary']],
        occupied: [['available', 'Trả bàn', 'success']],
        maintenance: [['available', 'Kết thúc bảo trì', 'success']]
    };

    var grid = document.getElementById('table-grid');
    var emptyBox = document.getElementById('empty-table-result');
    var search = A.fresh('table-search-input');
    var statusFilter = A.fresh('table-status-filter');
    var resetBtn = A.fresh('reset-table-filter');
    var refreshBtn = A.fresh('refresh-tables-button');
    var all = [];

    function setStat(id, value) {
        var element = document.getElementById(id);
        if (element) element.textContent = value;
    }
    function resetStats() {
        ['total-table-count', 'available-table-count', 'occupied-table-count', 'maintenance-table-count']
            .forEach(function (id) { setStat(id, '—'); });
    }
    resetStats();
    grid.innerHTML = '<div class="col-12 text-center text-secondary py-4">Đang tải sơ đồ bàn...</div>';

    // Những thứ API chưa hỗ trợ
    var areaSelect = document.getElementById('table-area-filter');
    if (areaSelect) areaSelect.closest('[class*="col-"]').remove();
    var addBtn = document.getElementById('open-add-table-button');
    if (addBtn) addBtn.remove();
    if (statusFilter) {
        Array.prototype.slice.call(statusFilter.options).forEach(function (o) {
            if (o.value !== 'all' && !STATUS[o.value]) o.remove();
        });
    }

    function card(t) {
        var st = STATUS[t.status] || { text: t.status, cls: '' };
        var items = (NEXT[t.status] || []).map(function (n) {
            return '<li><button type="button" class="dropdown-item text-' + n[2] + '" data-act="' + n[0] + '" data-id="' + A.esc(t.id) + '">' + n[1] + '</button></li>';
        }).join('');
        return '<div class="col-12 col-sm-6 col-lg-4 col-xl-3"><article class="table-management-card ' + st.cls + '">' +
            '<div class="table-card-header"><span class="table-status-label">' + st.text + '</span>' +
            '<div class="dropdown"><button class="btn btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Thao tác"><i class="bi bi-three-dots-vertical"></i></button>' +
            '<ul class="dropdown-menu dropdown-menu-end">' + items + '</ul></div></div>' +
            '<div class="table-card-body"><i class="bi bi-table table-card-icon"></i><h4>' + A.esc(t.name) + '</h4>' +
            '<p>' + (t.capacity != null ? A.esc(t.capacity) + ' người' : '') + '</p></div></article></div>';
    }

    function stats() {
        var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
        set('total-table-count', all.length);
        ['available', 'occupied', 'maintenance'].forEach(function (s) {
            set(s + '-table-count', all.filter(function (t) { return t.status === s; }).length);
        });
    }

    function render() {
        var q = (search && search.value || '').trim().toLowerCase();
        var s = statusFilter && statusFilter.value;
        var list = all.filter(function (t) {
            if (s && s !== 'all' && t.status !== s) return false;
            if (q && String(t.name).toLowerCase().indexOf(q) === -1) return false;
            return true;
        });
        grid.innerHTML = list.map(card).join('');
        var cnt = document.getElementById('visible-table-count');
        if (cnt) cnt.textContent = list.length;
        if (emptyBox) emptyBox.classList.toggle('d-none', list.length > 0);
    }

    async function load() {
        try {
            all = await A.api('/api/tables');
            stats();
            render();
        } catch (err) {
            console.error('Lỗi tải sơ đồ bàn:', err);
            resetStats();
            grid.innerHTML = '<div class="col-12"><div class="alert alert-danger mb-0">Không tải được sơ đồ bàn.</div></div>';
            A.toast(err.message, 'error');
        }
    }

    grid.addEventListener('click', async function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        try {
            var res = await A.api('/api/tables/' + encodeURIComponent(btn.dataset.id) + '/status', {
                method: 'PATCH',
                body: JSON.stringify({ status: btn.dataset.act })
            });
            A.toast(res.message);
            await load();
        } catch (err) {
            A.toast(err.message, 'error');
        }
    });

    [search, statusFilter].forEach(function (el) {
        if (el) { el.addEventListener('input', render); el.addEventListener('change', render); }
    });
    if (resetBtn) resetBtn.addEventListener('click', function () {
        if (search) search.value = '';
        if (statusFilter) statusFilter.value = 'all';
        render();
    });
    if (refreshBtn) refreshBtn.addEventListener('click', load);

    load();
});

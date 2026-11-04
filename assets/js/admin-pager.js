/* Phân trang dùng chung cho admin/orders.html và admin/invoices.html.
   Dùng lại khối .card-footer có sẵn trong HTML (đoạn chữ "Hiển thị..." + thẻ ul.pagination). */
window.AdminPager = (function () {
    'use strict';

    function item(label, page, disabled, active) {
        return '<li class="page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '') + '">' +
            '<button type="button" class="page-link" data-page="' + page + '">' + label + '</button></li>';
    }

    // opts: { page, totalPages, total, limit, noun, onChange(page) }
    function render(footer, opts) {
        if (!footer) return;
        var info = footer.querySelector('p');
        var ul = footer.querySelector('.pagination');
        var from = opts.total === 0 ? 0 : (opts.page - 1) * opts.limit + 1;
        var to = Math.min(opts.page * opts.limit, opts.total);
        if (info) info.textContent = 'Hiển thị ' + from + '–' + to + ' trong tổng số ' + opts.total + ' ' + opts.noun;
        if (!ul) return;

        // Hiện tối đa 5 số trang quanh trang hiện tại
        var start = Math.max(1, Math.min(opts.page - 2, opts.totalPages - 4));
        var end = Math.min(opts.totalPages, start + 4);
        var html = item('Trước', opts.page - 1, opts.page <= 1, false);
        for (var p = start; p <= end; p++) html += item(p, p, false, p === opts.page);
        html += item('Sau', opts.page + 1, opts.page >= opts.totalPages, false);
        ul.innerHTML = html;

        // Gán lại sự kiện click mỗi lần vẽ (ul.onclick ghi đè, không bị gán trùng)
        ul.onclick = function (e) {
            var btn = e.target.closest('button[data-page]');
            if (!btn || btn.closest('.disabled')) return;
            opts.onChange(Number(btn.dataset.page));
        };
    }

    return { render: render };
})();

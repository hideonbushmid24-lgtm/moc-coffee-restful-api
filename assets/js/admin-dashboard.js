/* Trang admin/dashboard.html: lấy toàn bộ thống kê từ database. */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    var A = window.AdminAuth;

    function setText(id, value) {
        var element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    function money(value) {
        return Number(value || 0).toLocaleString('vi-VN') + 'đ';
    }

    function compactMoney(value) {
        var amount = Number(value || 0);

        if (amount >= 1000000) {
            return (
                (amount / 1000000)
                    .toLocaleString('vi-VN', {
                        maximumFractionDigits: 1,
                    }) + 'tr'
            );
        }

        if (amount >= 1000) {
            return (
                (amount / 1000)
                    .toLocaleString('vi-VN', {
                        maximumFractionDigits: 0,
                    }) + 'k'
            );
        }

        return amount.toLocaleString('vi-VN');
    }

    function setCard(valueId, label, value, note) {
        var valueElement = document.getElementById(valueId);

        if (!valueElement) {
            return;
        }

        valueElement.textContent = value;

        var body = valueElement.closest('.card-body');
        var labelElement =
            body && body.querySelector('p.text-secondary');
        var noteElement =
            body && body.querySelector('small');

        if (labelElement && label) {
            labelElement.textContent = label;
        }

        if (noteElement) {
            noteElement.className = 'text-secondary';
            noteElement.textContent = note || '';
        }
    }

    function dateKey(date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');

        return year + '-' + month + '-' + day;
    }

    function monthKey(date) {
        return (
            date.getFullYear() +
            '-' +
            String(date.getMonth() + 1).padStart(2, '0')
        );
    }

    function parseToday(todayKey) {
        var parts = String(todayKey || '')
            .split('-')
            .map(Number);

        if (parts.length !== 3 || parts.some(Number.isNaN)) {
            return new Date();
        }

        return new Date(
            parts[0],
            parts[1] - 1,
            parts[2],
            12,
            0,
            0
        );
    }

    function buildRevenueSlots(period, todayKey) {
        var today = parseToday(todayKey);
        var slots = [];

        if (period === '12-months') {
            for (var monthOffset = 11; monthOffset >= 0; monthOffset--) {
                var monthDate = new Date(
                    today.getFullYear(),
                    today.getMonth() - monthOffset,
                    1,
                    12,
                    0,
                    0
                );

                slots.push({
                    key: monthKey(monthDate),
                    label:
                        'T' +
                        String(monthDate.getMonth() + 1),
                });
            }

            return slots;
        }

        var totalDays = period === '30-days' ? 30 : 7;

        for (var dayOffset = totalDays - 1; dayOffset >= 0; dayOffset--) {
            var dayDate = new Date(today);
            dayDate.setDate(today.getDate() - dayOffset);

            slots.push({
                key: dateKey(dayDate),
                label:
                    totalDays === 7
                        ? dayDate.toLocaleDateString('vi-VN', {
                              weekday: 'short',
                          })
                        : dayDate.toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                          }),
            });
        }

        return slots;
    }

    function renderRevenue(data, period, todayKey) {
        var revenue = data || {};
        var series = Array.isArray(revenue.series)
            ? revenue.series
            : [];

        var amountByKey = {};

        series.forEach(function (item) {
            amountByKey[item.key] = Number(item.amount || 0);
        });

        var slots = buildRevenueSlots(period, todayKey);

        slots.forEach(function (slot) {
            slot.amount = amountByKey[slot.key] || 0;
        });

        var maxAmount = Math.max(
            1,
            ...slots.map(function (slot) {
                return slot.amount;
            })
        );

        var chart = document.getElementById('revenue-chart');

        if (!chart) {
            return;
        }

        chart.innerHTML = slots
            .map(function (slot) {
                var height =
                    slot.amount > 0
                        ? Math.max(
                              5,
                              Math.round(
                                  (slot.amount / maxAmount) * 100
                              )
                          )
                        : 0;

                return (
                    '<div class="revenue-column">' +
                    '<div class="revenue-value">' +
                    compactMoney(slot.amount) +
                    '</div>' +
                    '<div class="revenue-bar-wrapper">' +
                    '<div class="revenue-bar" style="height:' +
                    height +
                    '%"></div>' +
                    '</div>' +
                    '<span>' +
                    A.esc(slot.label) +
                    '</span>' +
                    '</div>'
                );
            })
            .join('');

        var titles = {
            '7-days': 'Doanh thu 7 ngày gần nhất',
            '30-days': 'Doanh thu 30 ngày gần nhất',
            '12-months': 'Doanh thu 12 tháng gần nhất',
        };

        setText(
            'revenue-period-title',
            titles[period] || titles['7-days']
        );

        setText(
            'revenue-period-total',
            money(revenue.total)
        );
    }

    function renderTableStatus(data) {
        var total = Number(data.totalTables || 0);
        var available = Number(data.availableTables || 0);
        var occupied = Number(data.occupiedTables || 0);
        var reserved = Number(data.reservedTables || 0);
        var maintenance = Number(
            data.maintenanceTables || 0
        );

        var occupiedPercent = total
            ? Math.round((occupied * 100) / total)
            : 0;

        setText(
            'dashboard-total-tables',
            'Tổng cộng ' + total + ' bàn'
        );

        setText(
            'table-occupied-percent',
            occupiedPercent + '%'
        );

        setText('available-table-count', available);
        setText('occupied-table-count', occupied);
        setText('reserved-table-count', reserved);
        setText('maintenance-table-count', maintenance);

        var occupiedEnd = total
            ? (occupied * 100) / total
            : 0;

        var reservedEnd = total
            ? occupiedEnd + (reserved * 100) / total
            : 0;

        var maintenanceEnd = total
            ? reservedEnd + (maintenance * 100) / total
            : 0;

        var circle = document.getElementById(
            'table-status-circle'
        );

        if (circle) {
            circle.style.background =
                'radial-gradient(circle at center,' +
                ' var(--admin-card-bg) 0 55%,' +
                ' transparent 56%),' +
                ' conic-gradient(' +
                'var(--admin-danger) 0 ' +
                occupiedEnd +
                '%,' +
                'var(--admin-warning) ' +
                occupiedEnd +
                '% ' +
                reservedEnd +
                '%,' +
                '#6c757d ' +
                reservedEnd +
                '% ' +
                maintenanceEnd +
                '%,' +
                'var(--admin-success) ' +
                maintenanceEnd +
                '% 100%)';
        }
    }

    function revenueComparison(today, yesterday) {
        var current = Number(today || 0);
        var previous = Number(yesterday || 0);

        if (previous <= 0) {
            return 'Hôm qua: ' + money(previous);
        }

        var percent = Math.round(
            ((current - previous) / previous) * 100
        );

        if (percent > 0) {
            return 'Tăng ' + percent + '% so với hôm qua';
        }

        if (percent < 0) {
            return 'Giảm ' + Math.abs(percent) + '% so với hôm qua';
        }

        return 'Không đổi so với hôm qua';
    }

    function formatTime(value) {
        var date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return '--:--';
        }

        return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function orderStatus(status, paymentStatus) {
        if (paymentStatus === 'paid' && status === 'completed') {
            return { text: 'Hoàn thành', css: 'text-bg-success' };
        }

        var statuses = {
            pending: { text: 'Chờ xác nhận', css: 'text-bg-secondary' },
            confirmed: { text: 'Đã xác nhận', css: 'text-bg-primary' },
            preparing: { text: 'Đang chế biến', css: 'text-bg-warning' },
            ready: { text: 'Sẵn sàng phục vụ', css: 'text-bg-info' },
            completed: { text: 'Hoàn thành', css: 'text-bg-success' },
            cancelled: { text: 'Đã hủy', css: 'text-bg-danger' },
        };

        return statuses[status] || {
            text: status || 'Không xác định',
            css: 'text-bg-secondary',
        };
    }

    function renderRecentOrders(items) {
        var body = document.getElementById('dashboard-recent-orders');
        var orders = Array.isArray(items) ? items : [];

        if (!body) return;

        if (!orders.length) {
            body.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-secondary">Chưa có đơn hàng.</td></tr>';
            return;
        }

        body.innerHTML = orders.map(function (order) {
            var status = orderStatus(order.status, order.paymentStatus);
            var location = order.orderType === 'takeaway'
                ? 'Mang đi'
                : 'Bàn ' + (order.tableCode || '--');

            return '<tr>' +
                '<td class="ps-4"><a href="orders.html" class="fw-semibold">#' + A.esc(order.orderCode) + '</a></td>' +
                '<td>' + A.esc(location) + '</td>' +
                '<td>' + A.esc(formatTime(order.createdAt)) + '</td>' +
                '<td class="fw-semibold">' + A.esc(money(order.totalAmount)) + '</td>' +
                '<td class="pe-4"><span class="badge ' + status.css + '">' + A.esc(status.text) + '</span></td>' +
                '</tr>';
        }).join('');
    }

    function renderUpcomingBookings(items, todayKey) {
        var container = document.getElementById('dashboard-upcoming-bookings');
        var bookings = Array.isArray(items) ? items : [];

        if (!container) return;

        if (!bookings.length) {
            container.innerHTML = '<p class="text-center text-secondary mb-0">Chưa có lịch đặt bàn sắp tới.</p>';
            return;
        }

        container.innerHTML = bookings.map(function (booking, index) {
            var date = String(booking.bookingDate || '').slice(0, 10);
            var dateLabel = date === todayKey
                ? 'Hôm nay'
                : new Date(date + 'T12:00:00').toLocaleDateString('vi-VN');
            var confirmed = booking.status === 'confirmed';
            var time = String(booking.bookingTime || '').slice(0, 5);

            return '<div class="dashboard-booking-item' + (index === bookings.length - 1 ? ' mb-0' : '') + '">' +
                '<div class="booking-time-box"><strong>' + A.esc(time) + '</strong><small>' + A.esc(dateLabel) + '</small></div>' +
                '<div class="flex-grow-1"><div class="d-flex justify-content-between gap-2">' +
                '<strong>' + A.esc(booking.customerName) + '</strong>' +
                '<span class="badge ' + (confirmed ? 'text-bg-success' : 'text-bg-warning') + '">' + (confirmed ? 'Đã xác nhận' : 'Chờ xác nhận') + '</span>' +
                '</div><small class="text-secondary">Bàn ' + A.esc(booking.tableCode || '--') + ' · ' +
                A.esc(booking.guestCount) + ' khách · ' + A.esc(booking.area || 'Chưa phân khu') + '</small></div></div>';
        }).join('');
    }

    function renderBestSellers(items) {
        var container = document.getElementById('dashboard-best-sellers');
        var products = Array.isArray(items) ? items : [];
        var maximum = Math.max(1, ...products.map(function (item) {
            return Number(item.quantity || 0);
        }));

        if (!container) return;

        if (!products.length) {
            container.innerHTML = '<p class="text-center text-secondary mb-0">Hôm nay chưa có dữ liệu món bán chạy.</p>';
            return;
        }

        container.innerHTML = products.map(function (item, index) {
            var quantity = Number(item.quantity || 0);
            var width = Math.round((quantity * 100) / maximum);

            return '<div class="best-selling-item' + (index === products.length - 1 ? ' mb-0' : '') + '">' +
                '<div class="best-selling-rank">' + (index + 1) + '</div>' +
                '<div class="flex-grow-1"><div class="d-flex justify-content-between mb-2">' +
                '<strong>' + A.esc(item.name) + '</strong><span>' + quantity + ' phần</span></div>' +
                '<div class="progress" role="progressbar" aria-valuenow="' + width + '" aria-valuemin="0" aria-valuemax="100">' +
                '<div class="progress-bar bg-success" style="width:' + width + '%"></div></div></div>' +
                '<strong class="text-success">' + A.esc(money(item.revenue)) + '</strong></div>';
        }).join('');
    }

    async function load(period) {
        var selectedPeriod = period || '7-days';

        try {
            var data = await A.api(
                '/api/dashboard/stats?period=' +
                    encodeURIComponent(selectedPeriod)
            );

            setCard(
                'dashboard-revenue',
                'Doanh thu hôm nay',
                money(data.todayRevenue),
                revenueComparison(
                    data.todayRevenue,
                    data.yesterdayRevenue
                )
            );

            setCard(
                'dashboard-order-count',
                'Tổng đơn hàng',
                data.totalOrders,
                data.completedOrders + ' đơn đã hoàn thành'
            );

            setCard(
                'dashboard-booking-count',
                'Đặt bàn hôm nay',
                data.todayBookings,
                data.pendingBookings + ' yêu cầu chờ xác nhận'
            );

            var occupiedPercent = data.totalTables
                ? Math.round(
                      (data.occupiedTables * 100) /
                          data.totalTables
                  )
                : 0;

            setCard(
                'dashboard-table-count',
                'Bàn đang sử dụng',
                data.occupiedTables + '/' + data.totalTables,
                'Công suất hiện tại: ' +
                    occupiedPercent +
                    '% · ' +
                    data.reservedTables +
                    ' bàn đã đặt'
            );

            renderRevenue(
                data.revenue,
                selectedPeriod,
                data.todayKey
            );

            renderTableStatus(data);
            renderRecentOrders(data.recentOrders);
            renderUpcomingBookings(
                data.upcomingBookings,
                data.todayKey
            );
            renderBestSellers(data.bestSellers);
        } catch (err) {
            console.error('Lỗi tải dashboard:', err);
            A.toast(err.message, 'error');
        }
    }

    var periodFilter = A.fresh('revenue-period-filter');

    if (periodFilter) {
        periodFilter.addEventListener('change', function () {
            load(this.value);
        });
    }

    var refreshButton = A.fresh(
        'refresh-dashboard-button'
    );

    if (refreshButton) {
        refreshButton.addEventListener('click', function () {
            load(periodFilter ? periodFilter.value : '7-days');
        });
    }

    renderRecentOrders([]);
    renderUpcomingBookings([], '');
    renderBestSellers([]);
    load(periodFilter ? periodFilter.value : '7-days');
});

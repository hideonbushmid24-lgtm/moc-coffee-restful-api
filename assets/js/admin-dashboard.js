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

    load(periodFilter ? periodFilter.value : '7-days');
});
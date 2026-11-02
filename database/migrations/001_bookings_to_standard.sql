-- Chuyển bảng bookings KIỂU CŨ (cột phone, booking_time dạng DATETIME, number_of_guests, bảng `tables`)
-- sang cấu trúc CHUẨN (coffee_tables + bookings có booking_code, customer_phone, booking_date, booking_time, guest_count).
--
-- CHỈ CHẠY khi lệnh sau trả ra 1 dòng:   SHOW COLUMNS FROM bookings LIKE 'phone';
-- TRƯỚC KHI CHẠY, sao lưu:                mysqldump -u root -p moc_coffee > backup_moc_coffee.sql
-- Chạy:                                   mysql -u root -p < database/migrations/001_bookings_to_standard.sql
-- Booking cũ không có bàn (table_id NULL) không chuyển được; vẫn còn nguyên trong bookings_old_backup.

USE moc_coffee;

-- 1. Giữ lại bảng cũ để đối chiếu (bỏ khóa ngoại cũ để tên ràng buộc không trùng bảng mới)
ALTER TABLE bookings DROP FOREIGN KEY fk_bookings_table;
RENAME TABLE bookings TO bookings_old_backup;

-- 2. Tạo cấu trúc chuẩn (giống schema.sql)
CREATE TABLE IF NOT EXISTS coffee_tables (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    table_code VARCHAR(20) NOT NULL UNIQUE,
    table_name VARCHAR(100) NOT NULL,
    capacity INT UNSIGNED NOT NULL DEFAULT 2,
    area VARCHAR(100) NULL,
    status ENUM(
        'available',
        'occupied',
        'maintenance'
    ) NOT NULL DEFAULT 'available',
    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE bookings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(30) NOT NULL UNIQUE,
    table_id INT UNSIGNED NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(150) NULL,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    guest_count INT UNSIGNED NOT NULL,
    note VARCHAR(300) NULL,
    status ENUM(
        'pending',
        'confirmed',
        'seated',
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_bookings_date_time (
        booking_date,
        booking_time
    ),

    INDEX idx_bookings_status (status),

    CONSTRAINT fk_bookings_table
        FOREIGN KEY (table_id)
        REFERENCES coffee_tables(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

INSERT INTO coffee_tables (
    table_code,
    table_name,
    capacity,
    area,
    status
) VALUES
    (
        'T01',
        'Bàn T01',
        2,
        'Tầng trệt',
        'available'
    ),
    (
        'T02',
        'Bàn T02',
        2,
        'Tầng trệt',
        'available'
    ),
    (
        'T03',
        'Bàn T03',
        4,
        'Tầng trệt',
        'available'
    ),
    (
        'T04',
        'Bàn T04',
        4,
        'Tầng trệt',
        'available'
    ),
    (
        'T05',
        'Bàn T05',
        4,
        'Khu vực cửa sổ',
        'available'
    ),
    (
        'T06',
        'Bàn T06',
        6,
        'Khu vực cửa sổ',
        'available'
    ),
    (
        'T07',
        'Bàn T07',
        6,
        'Tầng 1',
        'available'
    ),
    (
        'T08',
        'Bàn T08',
        8,
        'Tầng 1',
        'available'
    )
ON DUPLICATE KEY UPDATE
    table_name = VALUES(table_name),
    capacity = VALUES(capacity),
    area = VALUES(area);

-- 3. Chuyển dữ liệu: tìm bàn mới theo tên bàn (Bàn T01...), tách DATETIME thành ngày + giờ
INSERT INTO bookings (
    booking_code, table_id, customer_name, customer_phone,
    booking_date, booking_time, guest_count, status, created_at
)
SELECT
    CONCAT('BK', LPAD(b.id, 8, '0')),
    c.id,
    b.customer_name,
    b.phone,
    DATE(b.booking_time),
    TIME(b.booking_time),
    b.number_of_guests,
    b.status,
    b.created_at
FROM bookings_old_backup b
JOIN `tables` t ON t.id = b.table_id
JOIN coffee_tables c ON c.table_name = t.name;

-- 4. Kiểm tra số dòng (cột chuyen_duoc có thể ít hơn cu nếu có booking không có bàn)
SELECT
    (SELECT COUNT(*) FROM bookings_old_backup) AS cu,
    (SELECT COUNT(*) FROM bookings) AS chuyen_duoc;

-- Sau khi kiểm tra ổn (không bắt buộc), có thể dọn bảng cũ:
--   DROP TABLE bookings_old_backup;
--   DROP TABLE `tables`;
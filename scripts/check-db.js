// Kiểm tra cấu trúc database có khớp với code không.
//   npm run check-db           chỉ báo cáo
//   npm run check-db -- --fix  báo cáo và TỰ SỬA các cột/giá trị ENUM còn thiếu
// Bảng bị thiếu hoàn toàn thì nhập database/schema.sql (an toàn, chỉ tạo bảng chưa có):
//   mysql --default-character-set=utf8mb4 -u root -p < database/schema.sql
require('dotenv').config();
const db = require('../config/db');
const { inspectSchema } = require('../config/schemaCheck');

(async () => {
    const apply = process.argv.includes('--fix');

    try {
        const { database, issues } = await inspectSchema(db);
        console.log(`Đang kiểm tra database "${database}"...\n`);

        if (!issues.length) {
            console.log('OK: cấu trúc database khớp với code.');
            return process.exit(0);
        }

        issues.forEach((issue, i) => console.log(`${i + 1}. ${issue.text}`));

        const missingTables = issues.filter((i) => i.kind === 'missing_table');
        const fixable = issues.filter((i) => i.fix);

        if (missingTables.length) {
            console.log('\nBảng còn thiếu: chạy lệnh sau (không xóa dữ liệu hiện có):');
            console.log('  mysql --default-character-set=utf8mb4 -u root -p < database/schema.sql');
        }

        if (fixable.length && !apply) {
            console.log('\nCác câu SQL sửa được tự động (chạy `npm run check-db -- --fix` để áp dụng):');
            fixable.forEach((i) => console.log('  ' + i.fix + ';'));
        }

        if (fixable.length && apply) {
            console.log('\nĐang sửa...');
            for (const issue of fixable) {
                try {
                    await db.query(issue.fix);
                    console.log('  Đã chạy: ' + issue.fix);
                } catch (error) {
                    console.log('  LỖI: ' + issue.fix + '\n       ' + error.message);
                }
            }
            console.log('\nChạy lại `npm run check-db` để kiểm tra kết quả.');
        }

        process.exit(1);
    } catch (error) {
        console.error('Không kiểm tra được:', error.code || '', error.message);
        process.exit(2);
    }
})();

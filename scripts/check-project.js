const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRS = [
    'admin',
    'assets',
    'backend/src',
    'config',
    'database',
    'docs',
    'middleware',
    'pages',
    'routes',
    'scripts',
    'tests',
];
const TEXT_EXTENSIONS = new Set([
    '.css', '.html', '.js', '.json', '.md', '.sql',
]);
const errors = [];
const files = [];

function walk(relativePath) {
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) return;

    const stat = fs.statSync(absolutePath);
    if (stat.isFile()) {
        files.push(relativePath.replaceAll('\\', '/'));
        return;
    }

    for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(path.join(relativePath, entry.name));
    }
}

for (const directory of SOURCE_DIRS) walk(directory);
for (const filename of ['server.js', 'index.html', 'package.json', 'README.md']) {
    walk(filename);
}

for (const relativePath of files) {
    const extension = path.extname(relativePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) continue;

    const absolutePath = path.join(ROOT, relativePath);
    const content = fs.readFileSync(absolutePath, 'utf8');

    // Chỉ bắt marker Git thật; không nhầm với các dòng phân cách dài trong comment.
    if (/^(?:<{7}|={7}|>{7})(?:\s|$)/m.test(content)) {
        errors.push(`${relativePath}: còn marker xung đột Git`);
    }

    if (extension === '.html') {
        const ids = [...content.matchAll(/(?:^|\s)id=["']([^"']+)["']/g)]
            .map((match) => match[1]);
        const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
        if (duplicates.length) {
            errors.push(`${relativePath}: trùng id HTML: ${duplicates.join(', ')}`);
        }
    }

    if (extension === '.js') {
        const result = spawnSync(process.execPath, ['--check', absolutePath], {
            encoding: 'utf8',
        });
        if (result.status !== 0) {
            errors.push(`${relativePath}: lỗi cú pháp JavaScript\n${result.stderr.trim()}`);
        }
    }
}

if (errors.length) {
    console.error(`Phát hiện ${errors.length} lỗi:\n`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
} else {
    console.log(`Kiểm tra thành công ${files.length} file: không có lỗi cú pháp JS, marker Git hoặc id HTML trùng.`);
}

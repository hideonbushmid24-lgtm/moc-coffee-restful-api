const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDirectory = path.join(
    __dirname,
    "../../uploads/products"
);

fs.mkdirSync(uploadDirectory, {
    recursive: true,
});

const extensionByMimeType = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
};

const allowedMimeTypes = new Set(
    Object.keys(extensionByMimeType)
);

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, uploadDirectory);
    },

    filename: (req, file, callback) => {
        const extension =
            extensionByMimeType[file.mimetype];

        const randomName = crypto
            .randomBytes(12)
            .toString("hex");

        const filename =
            `${Date.now()}-${randomName}${extension}`;

        callback(null, filename);
    },
});

const fileFilter = (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
        return callback(
            new Error(
                "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP"
            )
        );
    }

    callback(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 10,
        parts: 11,
    },
});

// Kiểm tra NỘI DUNG file (mimetype do client tự khai nên có thể giả).
// Đọc vài byte đầu để nhận ra JPEG / PNG / WEBP thật; sai thì xóa file và báo lỗi 400.
// Dùng sau upload.single("image"):  router.post("/", ..., upload.single("image"), verifyImageContent, createProduct)
const fsPromises = require("fs/promises");

const looksLikeImage = (buffer) => {
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp =
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP";

    return isJpeg || isPng || isWebp;
};

const verifyImageContent = async (req, res, next) => {
    if (!req.file) {
        return next(); // không upload ảnh thì bỏ qua
    }

    let valid = false;

    try {
        const handle = await fsPromises.open(req.file.path, "r");

        try {
            const buffer = Buffer.alloc(12);
            const { bytesRead } = await handle.read(buffer, 0, 12, 0);
            valid = looksLikeImage(buffer.subarray(0, bytesRead));
        } finally {
            await handle.close();
        }
    } catch (error) {
        console.error("Lỗi kiểm tra nội dung ảnh:", error.code);
    }

    if (!valid) {
        await fsPromises.unlink(req.file.path).catch(() => {});

        return res.status(400).json({
            success: false,
            message: "File tải lên không phải ảnh JPG, PNG hoặc WEBP hợp lệ",
        });
    }

    next();
};

module.exports = {
    upload,
    verifyImageContent,
};
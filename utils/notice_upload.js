const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v1: uuidv1 } = require('uuid');

const noticesDir = path.join(__dirname, '..', 'uploads', 'notices');

exports.uploadNoticeFile = () => {
    return multer({
        storage: multer.diskStorage({
            destination: function (req, file, cb) {
                fs.mkdirSync(noticesDir, { recursive: true });
                cb(null, noticesDir);
            },
            filename: function (req, file, cb) {
                const name = `${uuidv1()}${path.extname(file.originalname)}`;
                cb(null, name);
            }
        }),
        fileFilter: function (req, file, cb) {
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Only PDF and image files (JPG, PNG) are allowed'), false);
            }
        },
        limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
    });
};

exports.noticesUploadPath = noticesDir;

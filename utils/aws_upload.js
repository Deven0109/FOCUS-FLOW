let multer = require('multer');
let path = require('path');
let fs = require('fs');
let multerS3 = require('multer-s3');
const { S3, S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v1: uuidv1 } = require('uuid');
let temporaryStorage = multer.memoryStorage();
let Jimp = require('jimp');
let _ = require('lodash');

exports.memory = multer({ storage: temporaryStorage });
const region = process.env.REGION;
const streamToBuffer = (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
};

exports.upload = (folder_path) => {
    try {
        let storage = multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, folder_path);
            },
            filename: function (req, file, cb) {
                cb(null, uuidv1() + path.extname(file.originalname));
            }
        });
        return multer({ storage: storage });
    } catch (err) {
        console.log(err);
    }
};

exports.uploadSync = (folder_path) => {
    try {
        let storage = multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, folder_path);
            },
            filename: function (req, file, cb) {
                cb(null, file.originalname);
            }
        });
        return multer({ storage: storage });
    } catch (err) {
        console.log(err);
    }
};

exports.removeFile = async (path) => {
    if (path != null && path != undefined && path.length > 0) {
        if (fs.existsSync(path)) {
            fs.unlinkSync(path);
        }
    }
};

//AWS S3 UPLOADS
const s3 = new S3Client({
    region: 'ap-south-1',
    credentials: {
        secretAccessKey: process.env.AWS_SECRET,
        accessKeyId: process.env.AWS_ID
    }
});

const s3N = new S3({
    region: region,
    credentials: {
        secretAccessKey: process.env.AWS_SECRET,
        accessKeyId: process.env.AWS_ID
    }
});

exports.s3 = s3N;

exports.uploadToAWS = (folderPath) => {
    return multer({
        storage: multerS3({
            s3: s3N,
            bucket: process.env.AWS_S3_BUCKET,
            contentType: multerS3.AUTO_CONTENT_TYPE,
            metadata: function (req, file, cb) {
                cb(null, { fieldName: file.fieldname });
            },
            key: function (req, file, cb) {
                let initialPath = req.body.servingCity == null ? `${folderPath}` : `${folderPath}/${req.body.servingCity}`;
                let newFilePath = `${initialPath}/${uuidv1()}${path.extname(file.originalname)}`;
                console.log(`-> file uploaded to: ${newFilePath}`);
                cb(null, newFilePath);
            }
        })
    });
};

exports.uploadDocumentsToAWS = () => {
    const folderPath = 'documents';
    return multer({
        storage: multerS3({
            s3: s3N,
            bucket: process.env.AWS_S3_BUCKET,
            contentType: multerS3.AUTO_CONTENT_TYPE,
            metadata: function (req, file, cb) {
                cb(null, { fieldName: file.fieldname });
            },
            key: function (req, file, cb) {
                const newFilePath = `${folderPath}/${uuidv1()}${path.extname(file.originalname)}`;
                console.log(`-> document uploaded to: ${newFilePath}`);
                cb(null, newFilePath);
            }
        }),
        fileFilter: function (req, file, cb) {
            if (file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                cb(new Error('Only PDF files are allowed'), false);
            }
        },
        limits: { fileSize: 20 * 1024 * 1024 }
    });
};

const documentsDir = path.join(__dirname, '..', 'uploads', 'documents');
exports.uploadDocumentsLocal = () => {
    return multer({
        storage: multer.diskStorage({
            destination: function (req, file, cb) {
                fs.mkdirSync(documentsDir, { recursive: true });
                cb(null, documentsDir);
            },
            filename: function (req, file, cb) {
                const name = `${uuidv1()}${path.extname(file.originalname)}`;
                cb(null, name);
            }
        }),
        fileFilter: function (req, file, cb) {
            if (file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                cb(new Error('Only PDF files are allowed'), false);
            }
        },
        limits: { fileSize: 20 * 1024 * 1024 }
    });
};
exports.documentsUploadPath = path.join(__dirname, '..', 'uploads', 'documents');

exports.s3Client = s3;
exports.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;

exports.uploadToAWSForApp = (path) => {
    return multer({
        storage: multerS3({
            s3: s3N,
            bucket: process.env.AWS_S3_BUCKET,
            contentType: multerS3.AUTO_CONTENT_TYPE,
            metadata: function (req, file, cb) {
                cb(null, { fieldName: file.fieldname });
            },
            key: function (req, file, cb) {
                console.log(`-> file uploaded to: ${path}`);
                cb(null, path);
            }
        })
    });
};
exports.fetchFromAWS = async (key) => {
    try {
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key
        };
        const command = new GetObjectCommand(params);
        let data = await s3N.send(command);
        data = await data.Body.transformToString();
        return data;
    } catch (err) {
        throw err;
    }
};

exports.uploadImageToAWS = async (path, compressedImageBuffer) => {
    try {
        const uploadParams = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: path,
            Body: compressedImageBuffer,
            ContentType: 'image/png'
        };

        const uploadCommand = new PutObjectCommand(uploadParams);
        await s3N.send(uploadCommand);
    } catch (err) {
        throw err;
    }
};

exports.fetchImageFromAWS = async (key) => {
    try {
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key
        };
        const command = new GetObjectCommand(params);
        let data = await s3N.send(command);
        data = await streamToBuffer(data.Body);
        return data;
    } catch (err) {
        throw err;
    }
};

exports.deleteFromAWS = async (filepath) => {
    try {
        const s3 = new S3Client({
            region: region,
            credentials: {
                secretAccessKey: process.env.AWS_SECRET,
                accessKeyId: process.env.AWS_ID
            }
        });

        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: filepath
        };

        const command = new DeleteObjectCommand(params);
        await s3.send(command);
    } catch (err) {
        console.log(err);
    }
};

exports.compressAndUploadThumbnail = async (req, res, next) => {
    const imageKey = req.file || req.files;
    if (!req.file && !req.files) {
        console.log('No files to process');
        return next();
    }

    let urls = [];
    if (_.isPlainObject(imageKey)) {
        if (req.files) {
            for (let key in imageKey) {
                if (Array.isArray(imageKey[key])) {
                    urls = urls.concat(imageKey[key]);
                } else if (_.isPlainObject(imageKey[key])) {
                    urls.push(imageKey[key]);
                }
            }
        } else if (req.file) {
            urls.push(imageKey);
        }
    } else if (_.isArray(imageKey)) {
        urls = urls.concat(imageKey);
    }

    try {
        await Promise.all(
            urls.map(async (file) => {
                const thumbPath = file.key.replace(/(\/[^\/]+)$/, '/thumb$1');

                const image = await Jimp.read(`${process.env.AWS_S3_ENDPOINT}${file.key}`);
                const resizedImage = image.scale(0.4).resize(200, 200);

                const buffer = await resizedImage.getBufferAsync(Jimp.MIME_JPEG);
                await s3N.putObject({
                    Bucket: file.bucket,
                    Key: thumbPath,
                    Body: buffer,
                    ContentType: file.contentType
                });
                console.log(`Thumbnail uploaded to: ${thumbPath}`);
            })
        );
        req.thumbFile = urls.map(({ key, location, ...file }) => ({
            ...file,
            location: location.replace(/(\/[^\/]+)$/, '/thumb$1'),
            key: key.replace(/(\/[^\/]+)$/, '/thumb$1')
        }));
        next();
    } catch (error) {
        console.error('Error processing thumbnail:', error);
        res.status(500).send('Failed to process and upload thumbnail');
    }
};
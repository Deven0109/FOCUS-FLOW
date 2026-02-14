const path = require('path');
const fs = require('fs');
const models = require('./../../models/zindex');
const response = require('./../../utils/response');
const asyncHandler = require('express-async-handler');
const { removeFile } = require('./../../utils/aws_upload');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

exports.list = asyncHandler(async (req, res) => {
    const user = await models.User.findById(req.userId).select('workType').lean();
    if (!user || !user.workType) {
        return response.success('Documents retrieved successfully', [], res);
    }
    const docs = await models.Document.find({ workType: user.workType })
        .populate('uploadedBy', 'name')
        .sort({ createdAt: -1 })
        .lean();
    return response.success('Documents retrieved successfully', docs, res);
});

exports.upload = asyncHandler(async (req, res) => {
    const { title, description, category, workType } = req.body;
    if (!title || !title.trim()) {
        return response.success('Title is required', null, res);
    }
    if (!req.file || !req.file.filename) {
        return response.success('Please upload a PDF file', null, res);
    }
    const allowedCategories = ['SOP', 'Others'];
    const docCategory = allowedCategories.includes(category) ? category : 'Others';
    const allowedWorkTypes = ['onsite', 'remote'];
    const docWorkType = allowedWorkTypes.includes(workType) ? workType : 'onsite';

    const fileKey = path.join('documents', req.file.filename);
    const doc = await models.Document.create({
        title: title.trim(),
        description: (description || '').trim(),
        category: docCategory,
        workType: docWorkType,
        fileKey,
        fileName: req.file.originalname || req.file.filename,
        uploadedBy: req.userId
    });
    const populated = await models.Document.findById(doc._id).populate('uploadedBy', 'name').lean();
    return response.success('Document uploaded successfully', populated, res);
});

exports.remove = asyncHandler(async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return response.success('Document ID is required', null, res);
    }
    const doc = await models.Document.findById(id);
    if (!doc) {
        return response.success('Document not found', null, res);
    }
    const filePath = path.join(UPLOADS_DIR, doc.fileKey);
    removeFile(filePath);
    await models.Document.findByIdAndDelete(id);
    return response.success('Document deleted successfully', true, res);
});

exports.download = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const doc = await models.Document.findById(id);
    if (!doc) {
        return response.notFound(res);
    }
    const user = await models.User.findById(req.userId).select('workType').lean();
    if (!user || doc.workType !== user.workType) {
        return response.forbidden('You do not have access to this document', res);
    }
    const filePath = path.join(UPLOADS_DIR, doc.fileKey);
    if (!fs.existsSync(filePath)) {
        return response.notFound(res);
    }
    const filename = doc.fileName || 'document.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
});

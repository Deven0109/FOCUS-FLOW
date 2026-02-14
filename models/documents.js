const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: '',
        trim: true
    },
    category: {
        type: String,
        enum: ['SOP', 'Others'],
        default: 'Others'
    },
    workType: {
        type: String,
        enum: ['onsite', 'remote'],
        default: 'onsite'
    },
    fileKey: {
        type: String,
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

documentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);

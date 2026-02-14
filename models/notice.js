const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const noticeSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    fileUrl: {
        type: String,
        default: ""
    },
    fileName: {
        type: String,
        default: ""
    },
    fileType: {
        type: String,
        enum: ['pdf', 'image', ''],
        default: ""
    },
    workTypeFilter: {
        type: String,
        enum: ['all', 'onsite', 'remote'],
        default: 'all'
    },
    targetEmployees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

noticeSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Notice', noticeSchema);

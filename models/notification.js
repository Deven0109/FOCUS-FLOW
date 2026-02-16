const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

/**
 * PRODUCTION-LEVEL NOTIFICATION SCHEMA
 * Tracks independent statuses (isRead, isDeleted) for every recipient in a single document.
 */
const notificationSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["WORK_UPLOAD", "NOTICE", "LEAVE_REQUEST"],
        required: true
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receivers: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        isRead: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        _id: false // Disable internal sub-doc ID to keep document lightweight
    }],
    workType: {
        type: String,
        enum: ["onsite", "remote", "all"],
        default: "all"
    },
    module: {
        type: String,
        enum: ["work", "notice-board", "leave-calendar"],
        required: true
    },
    referenceId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    priority: {
        type: String,
        enum: ["High", "Medium", "Low"],
        default: "Medium"
    }
}, {
    timestamps: true,
    versionKey: false
});

notificationSchema.plugin(mongoosePaginate);

// Safety: Clean up Mongoose cache to ensure new schema is picked up immediately
if (mongoose.models.Notification) {
    delete mongoose.models.Notification;
}

module.exports = mongoose.model('Notification', notificationSchema);

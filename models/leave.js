const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fromDate: {
        type: Date,
        required: true
    },
    toDate: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    leaveType: {
        type: String,
        enum: ['sick', 'casual', 'vacation', 'personal'],
        default: 'casual'
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'approved'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
leaveSchema.index({ user: 1, fromDate: 1, toDate: 1 });
leaveSchema.index({ status: 1 });

module.exports = mongoose.model('Leave', leaveSchema);

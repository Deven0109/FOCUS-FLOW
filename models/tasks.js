const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const taskSchema = new Schema({
    task: {
        type: String,
        required: true,
        trim: true
    },
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        default: 'not-started'
    },
    isTrackerStarted: { type: Boolean, default: false },
    initalStartedTime: { type: Date, default: "" },
    lastStartedTime: { type: Date, default: "" },
    endedTime: { type: Date, default: "" },
    estimatedTime: {
        hour: { type: String, default: "" },
        minutes: { type: String, default: "" }
    },
    priority: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'medium'
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    isAdded: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Task', taskSchema);
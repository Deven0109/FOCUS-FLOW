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
        enum: ['not-started', 'in-progress', 'hold', 'completed'],
        default: 'not-started'
    },
    priority: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'medium'
    },
    isTrackerStarted: { type: Boolean, default: false },
    initalStartedTime: { type: Date, default: "" },
    lastStartedTime: { type: Date, default: "" },
    endedTime: { type: Date, default: "" },
    countView: { type: String, default: "00:00:00" },
    totalSeconds: { type: Number, default: 0 },
    estimatedTime: {
        hour: { type: String, default: "" },
        minutes: { type: String, default: "" }
    },
    carriedOver: {
        type: Boolean,
        default: false
    },
    carriedOverNote: {
        type: String,
        default: null
    }
})

const dailyStatusSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    startTime: {
        type: Date,
        default: null
    },
    endTime: {
        type: Date,
        default: null
    },
    tasks: [taskSchema]
}, {
    timestamps: true
});

module.exports = mongoose.model('DailyStatus', dailyStatusSchema);
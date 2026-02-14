const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const ticketSchema = new mongoose.Schema({
    ticketNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    projectId: {
        type: mongoose.Types.ObjectId,
        required: true,
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    screenshots: [String],
    status: {
        type: String,
        enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
        default: 'Open'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    comments: [{
        text: String,
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

ticketSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Ticket', ticketSchema);
const mongoose = require('mongoose');

const productivityLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    dailyStatusId: { type: String, required: true },
    imageUrl: { type: String },
    isMatch: { type: Boolean, required: true },
}, {timestamps: true});

module.exports = mongoose.model('ProductivityLog', productivityLogSchema);
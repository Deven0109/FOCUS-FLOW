const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: Boolean,
        default: true
    },
}, { timestamps: true });

projectSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Project', projectSchema);
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+\@.+\..+/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    mobile: {
        type: String,
        required: true
    },
    jobTitle: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['superAdmin', 'hr', 'admin', 'developer'],
        default: 'developer'
    },
    workType: {
        type: String,
        enum: ['onsite', 'remote']
    },
    profileImage: {
        type: String,
        default: ""
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

userSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('User', userSchema);
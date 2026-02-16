const mongoose = require('mongoose');
const moment = require('moment-timezone');
const models = require('./../../models/zindex');
const helper = require('./../../utils/helper');
const response = require('./../../utils/response');
const { decrypt, encrypt } = require('./../../utils/encryption');
const asyncHandler = require("express-async-handler");

const validators = require('./validators/authentication.v');

exports.getDashboard = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const totalTasks = await models.DailyStatus.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId)
            }
        },
        { $unwind: '$tasks' },
        { $count: 'totalTasks' }
    ]);

    let users = 0;
    const adminRoles = ['superAdmin', 'hr', 'admin'];
    if (adminRoles.includes(req.userRole)) {
        users = await models.User.countDocuments({ role: { $nin: adminRoles } });
    }

    return response.success("Dashboard data retrieved successfully", {
        totalTasks: totalTasks.length == 1 ? totalTasks[0].totalTasks : 0,
        users: users
    }, res);
});

exports.getDeveloperReport = asyncHandler(async (req, res) => {
    const { workType, reportDate } = req.body;
    const adminRoles = ['superAdmin', 'hr', 'admin'];
    if (adminRoles.includes(req.userRole)) {
        let startTime = reportDate != null && reportDate != "" ? moment.utc(reportDate).tz('Asia/Kolkata').startOf('day').toDate() : moment().startOf('day').toDate();
        let endTime = reportDate != null && reportDate != "" ? moment.utc(reportDate).tz('Asia/Kolkata').endOf('day').toDate() : moment().endOf('day').toDate();
        // restrict to active developers of the selected work type
        let developers = await models.User.find({ role: 'developer', workType, isActive: true }).select('name mobile jobTitle isActive').lean();
        const dailyStatus = await models.DailyStatus.find({ date: { $gte: startTime, $lte: endTime } }).lean();
        for (let dev of developers) {
            const devId = dev._id;
            let hasResult = dailyStatus.filter((e) => String(e.user) == (devId));
            dev.startTime = hasResult.length > 0 ? moment.utc(hasResult[0].startTime).tz('Asia/Kolkata').format('MMM D, YYYY h:mm A') : '-';
            dev.endTime = hasResult.length > 0 ? hasResult[0].endTime != null ? moment.utc(hasResult[0].endTime).tz('Asia/Kolkata').format('MMM D, YYYY h:mm A') : '-' : '-';

            dev.totalTime = String(dev.startTime).includes('-') || (dev.endTime != null && String(dev.endTime).includes('-')) ? '-' : helper.formatTime(dev.startTime, dev.endTime);
            dev.tasks = hasResult.length > 0 ? hasResult[0].tasks : [];
            dev.dailyStatusId = hasResult.length > 0 ? hasResult[0]._id : null;
            dev.tasks = dev.tasks.map((e) => {
                e.initalStartedTime = e.initalStartedTime != null || e.initalStartedTime != "" ? moment.utc(e.initalStartedTime).tz('Asia/Kolkata').format('MMM D, YYYY h:mm A') : '-';
                e.endedTime = e.endedTime != null || e.endedTime != "" ? moment.utc(e.endedTime).tz('Asia/Kolkata').format('MMM D, YYYY h:mm A') : '-';
                return e;
            })
        }
        return response.success("Developers' today's report retrieved successfully", developers, res);
    }
    else {
        return response.success("Unauthorized access to developer report", [], res);
    }
});

exports.signIn = asyncHandler(async (req, res) => {
    const { error, value } = validators.signIn.validate(req.body);
    if (error) {
        return response.success(error.message, null, res);
    }

    let result = await models.User.findOne({ email: value.email }).lean();
    if (!result) {
        return response.success("Invalid email or password", null, res);
    }

    if (!result.isActive) { return response.success("Your account is deactive! Contact Admin", null, res); }

    let plainText = decrypt(result.password);
    if (plainText == value.password) {
        let object = {
            id: result._id,
            name: result.name,
            role: result.role,
            email: result.email,
            jobTitle: result.jobTitle,
            profileImage: result.profileImage,
            workType: result.workType
        };
        object.token = helper.generateToken({ id: result._id, role: result.role });
        return response.success("Logged in successfully", Object.seal(object), res);
    } else {
        return response.success("Invalid email or password", null, res);
    }
});

exports.saveUser = asyncHandler(async (req, res) => {
    let { error, value } = validators.createUser.validate(req.body);
    if (error) {
        console.log(`Joi Validation Failed: ${error.message}`, req.body);
        return response.badRequest(error.message, res);
    }

    // Default workType to 'onsite' for administrative roles for full module access
    if (value.role !== 'developer' && (!value.workType || value.workType === '')) {
        value.workType = 'onsite';
    }


    if (value._id != null && value._id != '') {
        const user = await models.User.findById(value._id);
        if (!user) { return response.success("User not found", null, res); }

        // Check if trying to promote to Super Admin and if one already exists
        if (value.role === 'superAdmin' && user.role !== 'superAdmin') {
            const superAdminCount = await models.User.countDocuments({ role: 'superAdmin' });
            if (superAdminCount > 0) {
                return response.success("Only one Super Admin is allowed in the system.", null, res);
            }
        }

        let result = await models.User.countDocuments({
            _id: { $nin: [value._id] },
            $or: [{ email: value.email }, { mobile: value.mobile }]
        });
        if (result > 0) {
            return response.badRequest("Account already exists with this email or mobile number", res);
        }

        delete value.password;
        await models.User.findByIdAndUpdate(value._id, value, { new: true });
        return response.success("User account updated successfully", true, res);
    } else {
        delete value._id;

        // Check if trying to create a Super Admin and if one already exists
        if (value.role === 'superAdmin') {
            const superAdminCount = await models.User.countDocuments({ role: 'superAdmin' });
            if (superAdminCount > 0) {
                return response.badRequest("Only one Super Admin is allowed in the system.", res);
            }
        }

        let result = await models.User.countDocuments({ $or: [{ email: value.email }, { mobile: value.mobile }] });
        if (result > 0) {
            return response.badRequest("Account already exists with this email or mobile number", res);
        }
        value.password = encrypt(value.password);
        await models.User.create(value);
        return response.success("User account created successfully", true, res);
    }
})

exports.getUsers = asyncHandler(async (req, res) => {
    const { page, limit, search, workType } = req.body;
    let searchRegex = new RegExp(search, "i");
    let query = {
        $or: [
            { name: searchRegex },
            { email: searchRegex },
        ],
    };
    if (workType != null && workType != "") {
        query.workType = workType;
    }
    let results = await models.User.paginate(query, {
        page,
        limit,
        sort: { role: 1, name: 1 },
        select: '-__v',
        lean: true
    });
    if (Array.isArray(results.docs)) {
        results.docs = results.docs.map((user) => {
            let plainPassword = "";
            try {
                plainPassword = user.password ? decrypt(user.password) : "";
            } catch (error) {
                plainPassword = "";
            }
            return {
                ...user,
                plainPassword
            };
        });
    }
    return response.success("Users retrieved successfully", results, res);
});

exports.toggleAccountStatus = asyncHandler(async (req, res) => {
    const { id, status } = req.body;
    let result = await models.User.findByIdAndUpdate(id, { isActive: status }, { new: true }).select('-password');
    return response.success("Account status updated successfully", result, res);
});

exports.deleteUserAccount = asyncHandler(async (req, res) => {
    const { id } = req.body;
    if (id == req.userId) {
        return response.success("Cannot delete your own account", null, res);
    }

    const targetUser = await models.User.findById(id);
    if (!targetUser) {
        return response.success("User not found", null, res);
    }

    let everWorked = await models.DailyStatus.countDocuments({ user: id });
    if (everWorked > 0) {
        return response.success("Cannot delete account with task history", null, res);
    } else {
        await models.User.findByIdAndDelete(id);
        return response.success("Account deleted successfully", true, res);
    }
})

exports.getAllUsers = asyncHandler(async (req, res) => {
    // Only surface accounts that are currently active to avoid picking inactive users elsewhere
    let results = await models.User.find({ isActive: true }).select('name role workType').sort({ name: 1 });
    return response.success("Users retrieved successfully", results, res);
});

exports.getProfile = asyncHandler(async (req, res) => {
    const userId = req.userId;
    let user = await models.User.findById(userId).select('-password');
    return response.success("Profile information retrieved successfully", user, res);
});

exports.changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    let user = await models.User.findById(req.userId).lean();
    let plainText = decrypt(user.password);
    if (plainText == oldPassword) {
        let encPassword = encrypt(newPassword);
        await models.User.findByIdAndUpdate(req.userId, { password: encPassword });
        return response.success("Password changed successfully", true, res);
    } else {
        return response.success("Old password does not match", null, res);
    }
});

exports.updateProfileImage = asyncHandler(async (req, res) => {
    const userId = req.userId;
    if (req.file) {
        let user = await models.User.findByIdAndUpdate(userId, { profileImage: req.file.key }, { new: true }).select('-password -createdAt -updatedAt').lean();
        const id = user._id;
        delete user._id;
        user.id = id;
        return response.success("Profie image updated", user, res);
    } else {
        return response.success("Image not found", null, res);
    }
})
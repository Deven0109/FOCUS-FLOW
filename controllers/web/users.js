const models = require('./../../models/zindex');
const response = require('./../../utils/response');
const { encrypt } = require('./../../utils/encryption');
const asyncHandler = require("express-async-handler");
const validators = require('./validators/authentication.v');
exports.createUser = asyncHandler(async (req, res) => {
    const { error, value } = validators.createUser.validate(req.body);
    if (error) {
        return response.success(`Validation failed: ${error.message}`, null, res);
    }
    if (value.id) {
        const user = await models.User.findById(value.id);
        if (user) {
            // Check if trying to promote to Super Admin and if one already exists
            if (value.role === 'superAdmin' && user.role !== 'superAdmin') {
                const superAdminCount = await models.User.countDocuments({ role: 'superAdmin' });
                if (superAdminCount > 0) {
                    return response.success("Only one Super Admin is allowed in the system.", null, res);
                }
            }

            user.name = value.name;
            user.email = value.email;
            user.role = value.role;
            user.mobile = value.mobile; // Added mobile update as well
            if (value.workType) user.workType = value.workType;
            await user.save();
            return response.success("User information updated successfully", true, res);
        }
        return response.success("User not found", null, res);
    } else {
        const existingUser = await models.User.countDocuments({ email: value.email });
        if (existingUser > 0) {
            return response.success("An account with this email already exists", null, res);
        }

        // Check if trying to create a Super Admin and if one already exists
        if (value.role === 'superAdmin') {
            const superAdminCount = await models.User.countDocuments({ role: 'superAdmin' });
            if (superAdminCount > 0) {
                return response.success("Only one Super Admin is allowed in the system.", null, res);
            }
        }

        value.password = encrypt(value.password);
        const newUser = await models.User.create(value);
        if (newUser) {
            return response.success("New user created successfully", true, res);
        }
        return response.success("Failed to create user", null, res);
    }
});

exports.getUsers = asyncHandler(async (req, res) => {
    const { search, page, limit } = req.body;
    const searchRegex = RegExp(search, "i");
    const results = await models.User.paginate({
        $or: [{ name: searchRegex }, { email: searchRegex }]
    }, page, limit);
    return response.success("Users retrieved successfully", results, res);
});

exports.updateUserStatus = asyncHandler(async (req, res) => {
    const { id, status } = req.body;
    const user = await models.User.findById(id);
    if (user) {
        user.isActive = status;
        await user.save();
        return response.success("User account status updated successfully", true, res);
    }
    return response.success("Invalid user ID provided", null, res);
});

exports.deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.body;
    const user = await models.User.findByIdAndDelete(id);
    if (user) {
        return response.success("User deleted successfully", true, res);
    }
    return response.success("User not found", null, res);
});

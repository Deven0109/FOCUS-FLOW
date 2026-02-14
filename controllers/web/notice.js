const asyncHandler = require("express-async-handler");
const models = require('./../../models/zindex');
const response = require('./../../utils/response');
const moment = require('moment-timezone');

/**
 * Get notices - HR sees all, Developers see filtered by workType
 */
exports.getNotices = asyncHandler(async (req, res) => {
    try {
        console.log('=== getNotices called ===');
        console.log('User Role:', req.userRole);
        console.log('User ID:', req.userId);
        console.log('User WorkType:', req.userWorkType);

        const userRole = req.userRole;
        const userId = req.userId;
        const userWorkType = req.userWorkType || 'onsite';

        let query = { isActive: true };

        // Developers see notices that are:
        // 1. Targeted to all work types AND (no specific employees OR includes this user)
        // 2. Targeted to their work type AND (no specific employees OR includes this user)
        if (userRole === 'developer') {
            query.$or = [
                // Notices for "all" with no specific employees
                { workTypeFilter: 'all', targetEmployees: { $size: 0 } },
                // Notices for "all" that include this user
                { workTypeFilter: 'all', targetEmployees: userId },
                // Notices for user's work type with no specific employees
                { workTypeFilter: userWorkType, targetEmployees: { $size: 0 } },
                // Notices for user's work type that include this user
                { workTypeFilter: userWorkType, targetEmployees: userId }
            ];
        }

        console.log('Query:', JSON.stringify(query, null, 2));

        const notices = await models.Notice.find(query)
            .populate('createdBy', 'name email')
            .populate('targetEmployees', 'name email')
            .sort({ createdAt: -1 });

        console.log('Notices found:', notices.length);
        return response.success("Notices fetched successfully", notices, res);
    } catch (error) {
        console.error('Error in getNotices:', error);
        return response.serverError(error, res);
    }
});

/**
 * Create notice - HR only
 */
exports.createNotice = asyncHandler(async (req, res) => {
    const { title, content, workTypeFilter, targetEmployees } = req.body;
    const fileUrl = req.file ? `/uploads/notices/${req.file.filename}` : "";
    const fileName = req.file ? req.file.originalname : "";
    const fileType = req.file ? (req.file.mimetype.includes('pdf') ? 'pdf' : 'image') : "";

    // Parse targetEmployees if it's a JSON string
    let employeeIds = [];
    if (targetEmployees) {
        try {
            employeeIds = typeof targetEmployees === 'string' ? JSON.parse(targetEmployees) : targetEmployees;
        } catch (e) {
            employeeIds = [];
        }
    }

    const notice = await models.Notice.create({
        title,
        content,
        fileUrl,
        fileName,
        fileType,
        workTypeFilter: workTypeFilter || 'all',
        targetEmployees: employeeIds,
        createdBy: req.userId
    });

    return response.success("Notice created successfully", notice, res);
});

/**
 * Update notice - HR only
 */
exports.updateNotice = asyncHandler(async (req, res) => {
    const { _id, title, content, workTypeFilter, targetEmployees } = req.body;

    if (!_id) {
        return response.badRequest("Notice ID is required", res);
    }

    const notice = await models.Notice.findById(_id);
    if (!notice) {
        return response.badRequest("Notice not found", res);
    }

    notice.title = title;
    notice.content = content;
    notice.workTypeFilter = workTypeFilter || 'all';

    // Parse and update targetEmployees
    if (targetEmployees !== undefined) {
        try {
            notice.targetEmployees = typeof targetEmployees === 'string' ? JSON.parse(targetEmployees) : targetEmployees;
        } catch (e) {
            notice.targetEmployees = [];
        }
    }

    // Update file if new file uploaded
    if (req.file) {
        notice.fileUrl = `/uploads/notices/${req.file.filename}`;
        notice.fileName = req.file.originalname;
        notice.fileType = req.file.mimetype.includes('pdf') ? 'pdf' : 'image';
    }

    await notice.save();

    return response.success("Notice updated successfully", notice, res);
});

/**
 * Delete notice - HR only (soft delete)
 */
exports.deleteNotice = asyncHandler(async (req, res) => {
    const { _id } = req.body;

    if (!_id) {
        return response.badRequest("Notice ID is required", res);
    }

    const notice = await models.Notice.findById(_id);
    if (!notice) {
        return response.badRequest("Notice not found", res);
    }

    notice.isActive = false;
    await notice.save();

    return response.success("Notice deleted successfully", true, res);
});

/**
 * View single notice - HR and Developer
 */
exports.viewNotice = asyncHandler(async (req, res) => {
    const { _id } = req.body;

    if (!_id) {
        return response.badRequest("Notice ID is required", res);
    }

    const notice = await models.Notice.findById(_id)
        .populate('createdBy', 'name email')
        .populate('targetEmployees', 'name email');

    if (!notice || !notice.isActive) {
        return response.badRequest("Notice not found", res);
    }

    return response.success("Notice fetched successfully", notice, res);
});

/**
 * Get employees by work type - HR only
 */
exports.getEmployeesByWorkType = asyncHandler(async (req, res) => {
    const { workType } = req.body;

    let query = { role: 'developer', isActive: true };

    if (workType && workType !== 'all') {
        query.workType = workType;
    }

    const employees = await models.User.find(query)
        .select('_id name email workType')
        .sort({ name: 1 });

    return response.success("Employees fetched successfully", employees, res);
});

const Leave = require('../../models/leave');
const User = require('../../models/users');
const { createNotification } = require('../../utils/notificationHelper');

// Get all approved leaves (for calendar display)
exports.getAllLeaves = async (req, res) => {
    try {
        let { workType, view } = req.query; // Add 'view'

        // Sanitize
        if (!workType || workType === 'undefined' || workType === 'null') workType = 'all';
        workType = workType.toLowerCase().trim();

        const adminRoles = ['superadmin', 'hr', 'admin', 'human resource'];

        let userRole = '';
        if (req.user && req.user.role) {
            userRole = req.user.role;
        } else if (req.userRole) {
            userRole = req.userRole;
        }
        userRole = userRole.toLowerCase();

        const isAdmin = adminRoles.includes(userRole);

        let query = { status: 'approved' };

        // View Logic
        if (view === 'my') {
            const mongoose = require('mongoose');
            query.user = new mongoose.Types.ObjectId(req.userId);
            // My Leaves: Show pending too
            query.status = { $in: ['approved', 'pending'] };
        }
        else {
            // Team View (view='all')
            // 1. If Non-Admin, FORCE workType to their own type
            if (!isAdmin) {
                const user = await User.findById(req.userId).select('workType');
                workType = (user.workType || 'onsite').toLowerCase();
            }

            // 2. Filter by Work Type if specified (or forced)
            if (workType && workType !== 'all') {
                const users = await User.find({
                    workType: { $regex: new RegExp(`^${workType}$`, 'i') }
                }).select('_id');

                const userIds = users.map(u => u._id);
                query.user = { $in: userIds };
            }
        }

        const leaves = await Leave.find(query)
            .populate('user', 'name email workType')
            .sort({ fromDate: 1 });

        // Filter out orphaned leaves
        let filteredLeaves = leaves.filter(leave => leave.user);

        // Helper function to get color based on leave type
        const getLeaveColor = (type) => {
            switch (type ? type.toLowerCase() : '') {
                case 'casual': return 'rgba(13, 110, 253, 0.2)'; // Primary Blue (Transparent)
                case 'sick': return 'rgba(220, 53, 69, 0.2)';   // Danger Red (Transparent)
                case 'vacation': return 'rgba(25, 135, 84, 0.2)'; // Success Green (Transparent)
                case 'personal': return 'rgba(253, 126, 20, 0.2)'; // Orange (Transparent)
                default: return 'rgba(59, 130, 246, 0.2)';       // Default Blue (Transparent)
            }
        };

        // Format for FullCalendar
        const events = filteredLeaves.map(leave => {
            const start = new Date(leave.fromDate);
            const end = new Date(leave.toDate);

            // Count duration excluding Sundays
            let duration = 0;
            let current = new Date(start);
            current.setHours(0, 0, 0, 0);
            const endNorm = new Date(end);
            endNorm.setHours(0, 0, 0, 0);
            while (current <= endNorm) {
                if (current.getDay() !== 0) { // Skip Sunday (0)
                    duration++;
                }
                current.setDate(current.getDate() + 1);
            }

            const isPaid = leave.leaveCategory === 'Paid';
            return {
                id: leave._id,
                title: `View (${duration})${isPaid ? ' (Paid)' : ''}`,
                start: leave.fromDate,
                end: new Date(leave.toDate.getTime() + 86400000), // Add 1 day for FullCalendar (exclusive end)
                allDay: true,
                backgroundColor: getLeaveColor(leave.leaveType),
                borderColor: getLeaveColor(leave.leaveType),
                textColor: '#ffffff',
                extendedProps: {
                    userName: leave.user ? leave.user.name : 'Unknown',
                    userEmail: leave.user ? leave.user.email : '',
                    userWorkType: leave.user ? leave.user.workType : '',
                    leaveType: leave.leaveType,
                    title: leave.title || '', // Include title
                    reason: leave.reason,
                    status: leave.status,
                    duration: duration,
                    displayDateRange: `${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}`
                }
            };
        });

        res.status(200).json(events);
    } catch (error) {
        console.error('Error fetching leaves:', error);
        res.status(500).json({ message: 'Error fetching leaves', error: error.message });
    }
};

// Create new leave request
exports.createLeave = async (req, res) => {
    try {
        const { fromDate, toDate, reason, leaveType, title } = req.body;
        const userId = req.userId;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        // Determine user role for auto-approval
        let userRole = '';
        if (req.user && req.user.role) {
            userRole = req.user.role;
        } else if (req.userRole) {
            userRole = req.userRole;
        }
        userRole = userRole.toLowerCase();
        const autoApproveRoles = ['superadmin', 'hr', 'admin', 'human resource'];
        const isAutoApprove = autoApproveRoles.includes(userRole);

        // 1. Validate Fields
        if (!fromDate || !toDate || !reason || !title) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // 2. Parse Dates
        const start = new Date(fromDate);
        const end = new Date(toDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return res.status(400).json({ message: 'Invalid date' });
        if (start > end) return res.status(400).json({ message: 'Start date must be before end date' });

        // 3. Paid/Free Logic
        const startYear = start.getFullYear();
        const startMonth = start.getMonth();

        // Count Free leaves in THIS year (Approved or Pending)
        const yearlyFreeLeaves = await Leave.countDocuments({
            user: userId,
            leaveCategory: 'Free',
            status: { $in: ['approved', 'pending'] },
            fromDate: {
                $gte: new Date(startYear, 0, 1),
                $lt: new Date(startYear + 1, 0, 1)
            }
        });

        // Count TOTAL leaves in THIS month (Approved or Pending)
        const monthlyLeaves = await Leave.countDocuments({
            user: userId,
            status: { $in: ['approved', 'pending'] },
            fromDate: {
                $gte: new Date(startYear, startMonth, 1),
                $lt: new Date(startYear, startMonth + 1, 1)
            }
        });

        let category = 'Free';
        let isPaidReason = '';

        if (yearlyFreeLeaves >= 12) {
            category = 'Paid';
            isPaidReason = 'Yearly free leave limit (12) reached.';
        } else if (monthlyLeaves >= 1) {
            category = 'Paid';
            isPaidReason = 'Monthly free leave limit (1) reached.';
        }

        // 4. Create Leave Object
        // HR/Admin/SuperAdmin: auto-approved, Developer: pending
        const leaveStatus = isAutoApprove ? 'approved' : 'pending';

        const leave = new Leave({
            user: userId,
            fromDate: start,
            toDate: end,
            reason: reason,
            title: title + (category === 'Paid' ? ' (Paid)' : ''),
            leaveType: leaveType || 'casual',
            status: leaveStatus,
            leaveCategory: category
        });

        await leave.save();

        // 5. Send Notification
        const requester = await User.findById(userId).select('name workType');

        if (isAutoApprove) {
            // Auto-approved: Send notification to same workType users (like normal approval)
            const requesterWorkType = (requester && requester.workType) ? requester.workType : 'onsite';
            const targetUsers = await User.find({
                workType: { $regex: new RegExp(`^${requesterWorkType}$`, 'i') },
                isActive: true
            }).select('_id');

            let receiverIds = targetUsers.map(u => u._id.toString());
            const ownerId = userId.toString();
            if (!receiverIds.includes(ownerId)) {
                receiverIds.push(ownerId);
            }

            const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const dateRange = `${startStr} - ${endStr}`;

            await createNotification({
                title: "Leave Approved",
                message: `${requester ? requester.name : 'Unknown'} leave approved (${dateRange})`,
                type: "LEAVE_APPROVED",
                receivers: receiverIds,
                workType: requesterWorkType,
                module: "leave-calendar",
                referenceId: leave._id,
                sender: userId
            });
        } else {
            // Pending: Notify HR for approval
            const hrUsers = await User.find({ role: { $in: [/^hr$/i, /^human resource$/i] }, isActive: true }).select('_id');
            const hrIds = hrUsers.map(u => u._id);

            if (hrIds.length > 0) {
                await createNotification({
                    title: "New Leave Request",
                    message: `${requester ? requester.name : 'Unknown'} submitted a ${category} leave request`,
                    type: "LEAVE_REQUEST",
                    receivers: hrIds,
                    module: "leave-calendar",
                    referenceId: leave._id,
                    sender: userId
                });
            }
        }

        res.status(201).json({
            message: isAutoApprove ? 'Leave approved and added to calendar.' : 'Leave request submitted. Waiting for approval.',
            leave,
            autoApproved: isAutoApprove,
            warning: category === 'Paid' ? isPaidReason : null
        });

    } catch (error) {
        console.error('Error creating leave:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

// Get Leave Summary
exports.getLeaveSummary = async (req, res) => {
    try {
        console.log('--- getLeaveSummary CALLED ---');
        const userId = req.userId;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year + 1, 0, 1);

        console.log(`Calculating for user: ${userId}, Year: ${year}`);

        const leaves = await Leave.find({
            user: userId,
            status: { $in: ['approved', 'pending'] },
            fromDate: { $gte: startOfYear, $lt: endOfYear }
        });

        console.log(`Leaves found: ${leaves.length}`);

        // Calculate Days (Excluding Sundays)
        const monthlyDays = Array(12).fill(0);

        leaves.forEach(leave => {
            let current = new Date(leave.fromDate);
            const end = new Date(leave.toDate);

            // Normalize
            current.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);

            while (current <= end) {
                if (current.getFullYear() === year) {
                    const day = current.getDay();
                    if (day !== 0) { // Exclude Sunday
                        monthlyDays[current.getMonth()]++;
                    }
                }
                current.setDate(current.getDate() + 1);
            }
        });

        let freeUsed = 0;
        let paidUsed = 0;

        monthlyDays.forEach(days => {
            if (days > 0) {
                freeUsed += 1; // First is free
                paidUsed += (days - 1); // Rest paid
            }
        });

        console.log(`Result: Free=${freeUsed}, Paid=${paidUsed}`);

        const currentMonthUsed = monthlyDays[new Date().getMonth()];

        res.status(200).json({
            totalAllowed: 12,
            freeUsed: freeUsed,
            paidUsed: paidUsed,
            remainingFree: Math.max(0, 12 - freeUsed),
            monthlyUsed: currentMonthUsed
        });
    } catch (error) {
        console.error("Error fetching summary", error);
        res.status(500).json({ message: "Error fetching summary" });
    }
};

// Get Pending Leaves (For HR Dashboard)
exports.getPendingLeaves = async (req, res) => {
    try {
        const adminRoles = ['superadmin', 'hr', 'admin', 'human resource'];
        if (!adminRoles.includes((req.userRole || '').toLowerCase())) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const leaves = await Leave.find({ status: 'pending' })
            .populate('user', 'name email workType')
            .sort({ fromDate: 1 });

        res.status(200).json(leaves);
    } catch (error) {
        console.error('Error fetching pending leaves:', error);
        res.status(500).json({ message: 'Error fetching pending leaves' });
    }
};

// getLeaveAnalytics method
exports.getLeaveAnalytics = async (req, res) => {
    try {
        console.log('--- getLeaveAnalytics ---');
        console.log('User:', req.userId, 'Role:', req.userRole);
        console.log('Body:', req.body);

        const { timeRange, workType } = req.body;
        const userId = req.userId;
        const userRole = (req.userRole || '').toLowerCase();

        const adminRoles = ['superadmin', 'hr', 'admin', 'human resource'];
        const isAdmin = adminRoles.includes(userRole);

        // 1. Determine Date Range
        let startDate = new Date();

        switch (timeRange) {
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case '3months':
                startDate.setMonth(startDate.getMonth() - 3);
                break;
            case '6months':
                startDate.setMonth(startDate.getMonth() - 6);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default: // Default: Last Month
                startDate.setMonth(startDate.getMonth() - 1);
        }
        startDate.setHours(0, 0, 0, 0);
        console.log('Start Date:', startDate);

        // 2. Base Query
        let query = {
            fromDate: { $gte: startDate }
        };

        // 3. User Filter and Status Filter
        if (isAdmin) {
            // Admins strictly see APPROVED leaves for analytics
            query.status = 'approved';

            // Admin Filter by Work Type
            if (workType && workType !== 'all') {
                const users = await User.find({
                    workType: { $regex: new RegExp(`^${workType}$`, 'i') }
                }).select('_id');
                const userIds = users.map(u => u._id);
                query.user = { $in: userIds };
            }
        } else {
            // Non-admin: restrict to own user
            const mongoose = require('mongoose');
            query.user = new mongoose.Types.ObjectId(userId);

            // Employee sees Approved AND Pending to understand their full leave landscape
            query.status = { $in: ['approved', 'pending'] };
        }

        console.log('Query:', JSON.stringify(query));

        // 4. Fetch Leaves with User ID
        const leaves = await Leave.find(query).select('leaveType user');
        console.log('Leaves Found:', leaves.length);

        // 5. Aggregate by Leave Type
        const typeCounts = {
            'Casual': 0,
            'Sick': 0,
            'Vacation': 0,
            'Personal': 0,
            'Other': 0
        };

        const userSets = {
            'Casual': new Set(),
            'Sick': new Set(),
            'Vacation': new Set(),
            'Personal': new Set(),
            'Other': new Set()
        };

        const normalizeType = (type) => {
            type = (type || 'casual').toLowerCase();
            if (type.includes('casual')) return 'Casual';
            if (type.includes('sick')) return 'Sick';
            if (type.includes('vacation')) return 'Vacation';
            if (type.includes('personal')) return 'Personal';
            return 'Other';
        };

        leaves.forEach(leave => {
            const key = normalizeType(leave.leaveType);
            typeCounts[key]++;
            if (leave.user) {
                userSets[key].add(leave.user.toString());
            }
        });

        // 6. Construct Chart Data
        const labels = Object.keys(typeCounts).filter(key => typeCounts[key] > 0);
        const dataPoints = labels.map(key => typeCounts[key]);
        const userCounts = labels.map(key => userSets[key].size);

        // Color Mapping
        const backgroundColors = labels.map(label => {
            switch (label) {
                case 'Casual': return '#0d6efd'; // Blue
                case 'Sick': return '#dc3545';   // Red
                case 'Vacation': return '#198754'; // Green
                case 'Personal': return '#fd7e14'; // Orange
                default: return '#6c757d';       // Grey
            }
        });

        // Dataset Label based on filter
        let datasetLabel = isAdmin
            ? `${workType ? (workType.charAt(0).toUpperCase() + workType.slice(1)) : 'All'} Leaves`
            : 'My Leaves';

        const datasets = [{
            label: datasetLabel,
            data: dataPoints,
            backgroundColor: backgroundColors,
            hoverOffset: 4
        }];

        res.status(200).json({
            labels: labels,
            datasets: datasets,
            userCounts: userCounts,
            isAdmin: isAdmin
        });

    } catch (error) {
        console.error('Error fetching leave analytics:', error);
        res.status(500).json({ message: 'Error fetching analytics', error: error.message });
    }
};

// Update Leave Status (Approve/Reject)
exports.updateLeaveStatus = async (req, res) => {
    try {
        const { leaveId, status } = req.body;
        const userId = req.userId; // HR/Admin ID

        const adminRoles = ['superadmin', 'hr', 'admin', 'human resource'];
        if (!adminRoles.includes((req.userRole || '').toLowerCase())) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const leave = await Leave.findById(leaveId).populate('user', 'name email workType');
        if (!leave) {
            return res.status(404).json({ message: 'Leave not found' });
        }

        // Update Status
        leave.status = status; // 'approved' or 'rejected'  

        if (status === 'approved') {
            // Can add approvedBy here if needed
        }

        await leave.save();

        // NOTIFICATIONS
        const startStr = new Date(leave.fromDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const endStr = new Date(leave.toDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const dateRange = `${startStr} - ${endStr}`;

        if (status === 'approved') {
            const requesterWorkType = (leave.user && leave.user.workType) ? leave.user.workType : 'onsite';
            const targetUsers = await User.find({
                workType: { $regex: new RegExp(`^${requesterWorkType}$`, 'i') },
                isActive: true
            }).select('_id');

            let receiverIds = targetUsers.map(u => u._id.toString());

            if (leave.user && leave.user._id) {
                const ownerId = leave.user._id.toString();
                if (!receiverIds.includes(ownerId)) {
                    receiverIds.push(ownerId);
                }
            }

            const userName = leave.user ? leave.user.name : 'A User';

            await createNotification({
                title: "Leave Approved",
                message: `${userName} leave approved (${dateRange})`,
                type: "LEAVE_APPROVED",
                receivers: receiverIds,
                workType: requesterWorkType,
                module: "leave-calendar",
                referenceId: leave._id,
                sender: userId
            });

        } else if (status === 'rejected') {
            if (leave.user && leave.user._id) {
                await createNotification({
                    title: "Leave Rejected",
                    message: "your leave is rejectd",
                    type: "LEAVE_REJECTED",
                    receivers: [leave.user._id],
                    module: "leave-calendar",
                    referenceId: leave._id,
                    sender: userId
                });
            }
        }

        res.status(200).json({ message: `Leave ${status} successfully`, leave });

    } catch (error) {
        console.error('Error updating leave status:', error);
        res.status(500).json({ message: 'Error updating leave status' });
    }
};

// Get current user's leaves
exports.getUserLeaves = async (req, res) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalLeaves = await Leave.countDocuments({ user: userId });
        const leaves = await Leave.find({ user: userId })
            .populate('user', 'name email workType')
            .sort({ fromDate: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            leaves,
            totalLeaves,
            totalPages: Math.ceil(totalLeaves / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Error fetching user leaves:', error);
        res.status(500).json({ message: 'Error fetching user leaves', error: error.message });
    }
};

// Delete leave
exports.deleteLeave = async (req, res) => {
    try {
        const leaveId = req.params.id;
        const userId = req.userId; // Use req.userId attached by authMiddleware

        const leave = await Leave.findOne({ _id: leaveId, user: userId });

        if (!leave) {
            return res.status(404).json({ message: 'Leave not found or unauthorized' });
        }

        await Leave.deleteOne({ _id: leaveId });

        res.status(200).json({ message: 'Leave deleted successfully' });
    } catch (error) {
        console.error('Error deleting leave:', error);
        res.status(500).json({ message: 'Error deleting leave', error: error.message });
    }
};

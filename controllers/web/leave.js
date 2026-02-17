const Leave = require('../../models/leave');
const User = require('../../models/users');
const { createNotification } = require('../../utils/notificationHelper');

// Get all approved leaves (for calendar display)
// Get all approved leaves (for calendar display)
exports.getAllLeaves = async (req, res) => {
    try {
        console.log('--- getAllLeaves Request ---');
        console.log('User Role:', req.userRole);
        console.log('Raw Query:', req.query);

        let { workType } = req.query;
        // Sanitize input
        if (!workType || workType === 'undefined' || workType === 'null') {
            workType = 'all';
        }
        workType = workType.toLowerCase().trim();

        console.log('Sanitized workType:', workType);

        let query = { status: 'approved' };

        // Determine if user is admin/hr
        const adminRoles = ['superadmin', 'hr', 'admin', 'human resource'];
        const userRole = (req.userRole || '').toLowerCase();
        const isAdmin = adminRoles.includes(userRole);

        console.log('Is Admin?', isAdmin);

        const leaves = await Leave.find(query)
            .populate('user', 'name email workType')
            .sort({ fromDate: 1 });

        // Filter by user workType
        // If Admin: Use query param or 'all'
        // If Developer/Other: Force their own workType
        let targetWorkType = 'all';

        if (isAdmin) {
            targetWorkType = workType;
        } else {
            // Non-admin users can ONLY see their own workType
            targetWorkType = (req.userWorkType || 'onsite').toLowerCase();
            console.log(`Non-admin requesting leaves. Forcing workType: ${targetWorkType}`);
        }

        console.log('Final Target WorkType:', targetWorkType);

        let filteredLeaves = leaves.filter(leave => leave.user);
        const totalBeforeFilter = filteredLeaves.length;

        if (targetWorkType !== 'all') {
            filteredLeaves = filteredLeaves.filter(leave => {
                const userWT = (leave.user.workType || 'onsite').toLowerCase();
                return userWT === targetWorkType;
            });
        }

        console.log(`Filtering: ${totalBeforeFilter} -> ${filteredLeaves.length} leaves`);

        // Format for FullCalendar
        const events = filteredLeaves.map(leave => {
            const start = new Date(leave.fromDate);
            const end = new Date(leave.toDate);
            const diffTime = Math.abs(end - start);
            const duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            return {
                id: leave._id,
                title: `View (${duration})`,
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
        console.log('--- Create Leave Request Received ---');
        console.log('Body:', req.body);
        console.log('User ID:', req.userId);

        const { fromDate, toDate, reason, leaveType, title } = req.body;
        const userId = req.userId;

        if (!userId) {
            console.error('User ID missing!');
            return res.status(401).json({ message: 'Unauthorized: User authentication failed' });
        }

        // 1. Validate Fields
        if (!fromDate || !toDate || !reason || !title) {
            console.error('Missing fields');
            return res.status(400).json({ message: 'Missing required fields: From Date, To Date, Reason, or Title' });
        }

        // 2. Parse Dates
        const start = new Date(fromDate);
        const end = new Date(toDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.error('Invalid date format');
            return res.status(400).json({ message: 'Invalid date format' });
        }

        if (start > end) {
            console.error('Start date after end date');
            return res.status(400).json({ message: 'From date must be before or equal to To date' });
        }

        // 3. Create Leave Object
        const leave = new Leave({
            user: userId,
            fromDate: start,
            toDate: end,
            reason: reason,
            title: title, // Save title
            leaveType: leaveType || 'casual',
            status: 'pending' // ENTERPRISE LOGIC: Default to Pending
        });

        // 4. Save to DB
        console.log('Saving leave to DB...');
        await leave.save();
        console.log('Leave saved:', leave._id);

        // 5. Send Notification to HR/Admins ONLY
        const requester = await User.findById(userId).select('name');

        // Fix: Use regex for case-insensitive role matching to ensure no admins are missed
        const hrUsers = await User.find({
            role: {
                $in: [
                    /^hr$/i,
                    /^human resource$/i,
                    /^admin$/i,
                    /^superadmin$/i
                ]
            },
            isActive: true
        }).select('_id');

        const hrIds = hrUsers.map(u => u._id);

        await createNotification({
            title: "New Leave Request",
            message: `${requester ? requester.name : 'An employee'} submitted a leave request (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`,
            type: "LEAVE_REQUEST",
            receivers: hrIds, // Only HR gets this
            module: "leave-calendar",
            referenceId: leave._id,
            sender: userId
        });

        // 6. Respond
        const responseData = {
            message: 'Leave request submitted successfully. Waiting for approval.',
            leave: {
                id: leave._id,
                title: leave.title,
                start: leave.fromDate,
                end: leave.toDate,
                status: leave.status,
                // Add other props if needed by frontend 'response.leave' check
            }
        };

        res.status(201).json(responseData);

    } catch (error) {
        console.error('CRITICAL Error creating leave:', error);
        res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
            error: error.toString()
        });
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

        // If Approved, set metadata
        if (status === 'approved') {
            // leave.approvedBy = userId; // Schema doesn't have this yet, but good to add if schema updated
            // leave.approvedDate = new Date();
        }

        await leave.save();

        // NOTIFICATIONS
        const startStr = new Date(leave.fromDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const endStr = new Date(leave.toDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const dateRange = `${startStr} - ${endStr}`;

        if (status === 'approved') {
            // Determine the work type
            const requesterWorkType = (leave.user && leave.user.workType) ? leave.user.workType : 'onsite';

            // 1. Fetch Active Users (Case Insensitive Regex)
            const targetUsers = await User.find({
                workType: { $regex: new RegExp(`^${requesterWorkType}$`, 'i') },
                isActive: true
            }).select('_id');

            // Convert to unique string IDs
            let receiverIds = targetUsers.map(u => u._id.toString());

            // 2. Add Leave Owner
            if (leave.user && leave.user._id) {
                const ownerId = leave.user._id.toString();
                if (!receiverIds.includes(ownerId)) {
                    receiverIds.push(ownerId);
                }
            }

            // Fix name check
            const userName = leave.user ? leave.user.name : 'A User';

            // 3. Send Notification
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
            // 1. Notify Requesting User ONLY
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
        const userId = req.userId; // Use req.userId attached by authMiddleware
        const leaves = await Leave.find({ user: userId })
            .populate('user', 'name email workType')
            .sort({ fromDate: -1 });

        res.status(200).json(leaves);
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

// Helper function to get color based on leave type
const getLeaveColor = (type) => {
    switch (type ? type.toLowerCase() : '') {
        case 'casual': return 'rgba(13, 110, 253, 0.4)'; // Primary Blue (Transparent)
        case 'sick': return 'rgba(220, 53, 69, 0.4)';   // Danger Red (Transparent)
        case 'vacation': return 'rgba(25, 135, 84, 0.4)'; // Success Green (Transparent)
        case 'personal': return 'rgba(253, 126, 20, 0.4)'; // Orange (Transparent)
        default: return 'rgba(59, 130, 246, 0.4)';       // Default Blue (Transparent)
    }
};

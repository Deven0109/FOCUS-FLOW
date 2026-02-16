const Leave = require('../../models/leave');
const User = require('../../models/users');
const { createNotification } = require('../../utils/notificationHelper');

// Get all approved leaves (for calendar display)
// Get all approved leaves (for calendar display)
exports.getAllLeaves = async (req, res) => {
    try {
        const { workType } = req.query;
        let query = { status: 'approved' };

        const leaves = await Leave.find(query)
            .populate('user', 'name email workType')
            .sort({ fromDate: 1 });

        // Filter by user workType if specified
        let filteredLeaves = leaves.filter(leave => leave.user);
        if (workType && workType !== 'all') {
            filteredLeaves = filteredLeaves.filter(leave =>
                leave.user.workType && leave.user.workType.toLowerCase() === workType.toLowerCase()
            );
        }

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
            status: 'approved'
        });

        // 4. Save to DB
        console.log('Saving leave to DB...');
        await leave.save();
        console.log('Leave saved:', leave._id);

        // Send Notification to all active users
        const requester = await User.findById(userId).select('name');
        await createNotification({
            title: "New Leave Request",
            message: `${requester ? requester.name : 'An employee'} submitted a leave request`,
            type: "LEAVE_REQUEST",
            workType: "all",
            module: "leave-calendar",
            referenceId: leave._id,
            sender: userId
        });

        // 5. Populate User (Try/Catch wrapper)
        try {
            await leave.populate('user', 'name email workType');
        } catch (popError) {
            console.error('Error populating user:', popError);
            // Optionally continue without user details if it fails, but ideally we want them.
            // asking for User model explicitly might help if there's a registering issue
        }

        // 6. Respond
        const responseData = {
            message: 'Leave request created successfully',
            leave: {
                id: leave._id,
                title: `View (${Math.ceil(Math.abs(new Date(leave.toDate) - new Date(leave.fromDate)) / (1000 * 60 * 60 * 24)) + 1})`,
                start: leave.fromDate,
                end: new Date(leave.toDate.getTime() + 86400000),
                allDay: true,
                backgroundColor: getLeaveColor(leaveType),
                borderColor: getLeaveColor(leaveType),
                textColor: '#ffffff',
                extendedProps: {
                    userName: leave.user ? leave.user.name : 'Unknown',
                    userEmail: leave.user ? leave.user.email : '',
                    userWorkType: leave.user ? leave.user.workType : '',
                    leaveType: leave.leaveType,
                    title: leave.title || '',
                    reason: leave.reason,
                    status: leave.status,
                    duration: Math.ceil(Math.abs(new Date(leave.toDate) - new Date(leave.fromDate)) / (1000 * 60 * 60 * 24)) + 1,
                    displayDateRange: `${new Date(leave.fromDate).toLocaleDateString('en-GB')} - ${new Date(leave.toDate).toLocaleDateString('en-GB')}`
                }
            }
        };

        res.status(201).json(responseData);

    } catch (error) {
        console.error('CRITICAL Error creating leave:', error);
        // Send the actual error message to the frontend for debugging
        res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
            error: error.toString()
        });
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

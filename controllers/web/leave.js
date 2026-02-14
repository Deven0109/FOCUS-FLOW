const Leave = require('../../models/leave');
const User = require('../../models/users');

// Get all approved leaves (for calendar display)
exports.getAllLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find({ status: 'approved' })
            .populate('user', 'name email workType')
            .sort({ fromDate: 1 });

        // Format for FullCalendar
        const events = leaves.filter(leave => leave.user).map(leave => ({
            id: leave._id,
            title: leave.user ? leave.user.name : 'Unknown User',
            start: leave.fromDate,
            end: new Date(leave.toDate.getTime() + 86400000), // Add 1 day for FullCalendar (exclusive end)
            allDay: true, // Force block rendering
            backgroundColor: getLeaveColor(leave.leaveType),
            borderColor: getLeaveColor(leave.leaveType),
            extendedProps: {
                userName: leave.user ? leave.user.name : 'Unknown',
                userEmail: leave.user ? leave.user.email : '',
                leaveType: leave.leaveType,
                reason: leave.reason,
                status: leave.status
            }
        }));

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

        const { fromDate, toDate, reason, leaveType } = req.body;
        const userId = req.userId;

        if (!userId) {
            console.error('User ID missing!');
            return res.status(401).json({ message: 'Unauthorized: User authentication failed' });
        }

        // 1. Validate Fields
        if (!fromDate || !toDate || !reason) {
            console.error('Missing fields');
            return res.status(400).json({ message: 'Missing required fields: From Date, To Date, or Reason' });
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
            leaveType: leaveType || 'casual',
            status: 'approved'
        });

        // 4. Save to DB
        console.log('Saving leave to DB...');
        await leave.save();
        console.log('Leave saved:', leave._id);

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
                title: leave.user ? leave.user.name : 'New Leave',
                start: leave.fromDate,
                end: new Date(leave.toDate.getTime() + 86400000),
                allDay: true,
                backgroundColor: getLeaveColor(leave.leaveType),
                borderColor: getLeaveColor(leave.leaveType),
                extendedProps: {
                    userName: leave.user ? leave.user.name : 'Unknown',
                    userEmail: leave.user ? leave.user.email : '',
                    leaveType: leave.leaveType,
                    reason: leave.reason,
                    status: leave.status
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
            .populate('user', 'name email')
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
function getLeaveColor(leaveType) {
    const colors = {
        sick: '#dc3545',      // Red
        casual: '#0dcaf0',    // Cyan
        vacation: '#198754',  // Green
        personal: '#ffc107'   // Yellow
    };
    return colors[leaveType] || '#0dcaf0';
}

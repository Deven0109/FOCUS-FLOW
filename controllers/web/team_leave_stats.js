const Leave = require('../../models/leave');
const User = require('../../models/users');

// Get Team Leave Stats (For Admin/HR)
exports.getTeamLeaveStats = async (req, res) => {
    try {
        let { workType } = req.query;

        console.log('--- Get Team Leave Stats ---');
        console.log('Work Type:', workType);

        const adminRoles = ['superadmin', 'hr', 'admin', 'human resource'];

        // Defensive role check (handle req.user.role or req.userRole)
        let userRole = '';
        if (req.user && req.user.role) {
            userRole = req.user.role;
        } else if (req.userRole) {
            userRole = req.userRole;
        }
        userRole = userRole.toLowerCase();

        // Determine Requester Work Type
        let requesterWorkType = 'onsite';
        if (req.user && req.user.workType) {
            requesterWorkType = req.user.workType;
        } else if (req.user && req.user._id) {
            const requester = await User.findById(req.user._id).select('workType');
            if (requester) requesterWorkType = requester.workType;
        }

        // 2. Fetch Users based on Filter
        let userQuery = { isActive: true };

        if (adminRoles.includes(userRole)) {
            // Admin can access any workType
            if (workType && workType.toLowerCase() !== 'all') {
                userQuery.workType = { $regex: new RegExp(`^${workType}$`, 'i') };
            }
        } else {
            // Non-Admin: Can ONLY see their own workType
            userQuery.workType = { $regex: new RegExp(`^${requesterWorkType}$`, 'i') };
        }

        const users = await User.find(userQuery).select('name email workType profileImage').sort({ name: 1 });
        const userIds = users.map(u => u._id);

        console.log('Processing users count:', users.length);

        // 3. Fetch Leaves and Calculate Days
        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear + 1, 0, 1);

        const leaves = await Leave.find({
            user: { $in: userIds },
            status: 'approved',
            fromDate: { $gte: startOfYear, $lt: endOfYear }
        });

        // 4. Calculate Stats per User
        const statsMap = {};



        leaves.forEach(leave => {
            const userId = leave.user.toString();
            // Ensure we only process leaves for users in our filtered list
            if (!statsMap[userId]) {
                statsMap[userId] = {
                    monthlyDays: Array(12).fill(0)
                };
            }

            // Expand Leave Range to Dates for logic: "1 Free Leave per Month"
            let current = new Date(leave.fromDate);
            const end = new Date(leave.toDate);

            // Normalize to start of day
            current.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);

            while (current <= end) {
                // Ensure date is within current year
                if (current.getFullYear() === currentYear) {
                    const day = current.getDay();
                    // Logic:
                    // Sunday (0) is a holiday for everyone, so do not count as leave.

                    if (day !== 0) {
                        const month = current.getMonth(); // 0-11
                        statsMap[userId].monthlyDays[month]++;
                    }
                }
                current.setDate(current.getDate() + 1);
            }
        });

        const result = users.map(user => {
            const userId = user._id.toString();
            const stats = statsMap[userId] || { monthlyDays: Array(12).fill(0) };

            let freeLeaves = 0;
            let paidLeaves = 0;

            // Apply Policy: Max 1 Free Leave per Month
            stats.monthlyDays.forEach(daysInMonth => {
                if (daysInMonth > 0) {
                    // First day is free
                    freeLeaves += 1;
                    // Rest are paid
                    paidLeaves += (daysInMonth - 1);
                }
            });

            const totalLeaves = freeLeaves + paidLeaves;

            return {
                _id: user._id,
                name: user.name,
                email: user.email,
                workType: user.workType || 'onsite',
                profileImage: user.profileImage,
                freeLeave: freeLeaves,
                paidLeave: paidLeaves,
                totalLeave: totalLeaves,
                isPaidLeaveUser: paidLeaves > 0
            };
        });

        // Sort by total leaves descending
        result.sort((a, b) => b.totalLeave - a.totalLeave);

        res.status(200).json(result);

    } catch (error) {
        console.error('Error fetching team leave stats:', error);
        res.status(500).json({ message: 'Error fetching team stats', error: error.message });
    }
};

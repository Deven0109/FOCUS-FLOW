const xlsx = require('xlsx');
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const models = require('./../../models/zindex');
const response = require('./../../utils/response');
const asyncHandler = require("express-async-handler");
const { DateTime } = require('luxon');

exports.getAssignedTasks = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const getAssignedTasks = await models.Tasks.find({ assignedTo: userId, isAdded: false });
    return response.success("Tasks retrieved successfully", getAssignedTasks, res);
});

exports.getTodaysData = asyncHandler(async (req, res) => {
    const userId = req.userId;
    let data = await models.DailyStatus.find({
        user: userId,
        $or: [
            { endTime: null },
            { date: moment.utc().tz('Asia/Kolkata').startOf('day').toDate() },
        ]
    });
    return response.success("Day data fetched", data, res);
});

exports.getPreviousPendingTasks = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const timezone = 'Asia/Kolkata';
    const today = moment().tz(timezone).startOf('day').toDate();
    const previousDays = await models.DailyStatus.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId),
                date: { $lt: today },
                'tasks.status': { $in: ['not-started', 'in-progress'] },
                'tasks.carriedOver': false
            }
        },
        {
            $unwind: '$tasks'
        },
        {
            $match: {
                'tasks.status': { $in: ['not-started', 'in-progress'] }
            }
        },
        {
            $group: {
                _id: null,
                tasks: { $push: '$tasks' }
            }
        }
    ]);
    let tasks = previousDays[0]?.tasks || [];

    tasks = tasks.map((v) => {
        const id = v._id;
        v._id = new mongoose.Types.ObjectId();
        v.isThisTaskCarried = true;
        v.previousTaskId = id;
        return v;
    });

    return response.success("Previous tasks fetched", tasks, res);
});

exports.updateTasks = asyncHandler(async (req, res) => {
    let { id, tasks } = req.body;
    let dailyStatus = await models.DailyStatus.findById(id);
    if (dailyStatus != null) {
        if (dailyStatus.startTime != null && dailyStatus.endTime != null) {
            return response.success("Cannot update tasks! your day is ended.", null, res);
        } else {
            tasks = tasks.map((v) => {
                if (v._id == null) { v._id = new mongoose.Types.ObjectId(); }
                return v;
            });
            await models.DailyStatus.findByIdAndUpdate(id, { $set: { tasks: tasks } }, { new: true });
            return response.success("Tasks updated successfully!", true, res);
        }

    } else {
        return response.success("Unable to update tasks!", null, res);
    }
});

exports.updateTaskTimer = asyncHandler(async (req, res) => {
    let { id, task } = req.body;
    let dailyStatus = await models.DailyStatus.findById(id);
    if (dailyStatus != null) {
        if (dailyStatus.startTime != null && dailyStatus.endTime != null) {
            return response.success("Cannot update tasks! your day is ended.", null, res);
        } else {
            let tasks = dailyStatus.tasks;
            tasks = tasks.map((e) => { if (String(e._id) == String(task._id)) { e = task; } return e; });
            let result = await models.DailyStatus.findByIdAndUpdate(id, { $set: { tasks: tasks } }, { new: true });
            let updatedTask = result.tasks.filter((e) => String(e._id) == String(task._id))[0];
            return response.success("Task updated successfully!", updatedTask, res);
        }
    } else {
        return response.success("Unable to update tasks!", null, res);
    }
});

exports.startTimer = asyncHandler(async (req, res) => {
    let { user, tasks } = req.body;
    const timezone = 'Asia/Kolkata';
    const todayDateTime = moment().tz(timezone).startOf('day').toDate();
    const currentDateTime = moment().tz(timezone).toDate();

    let countIfAlreadyStarted = await models.DailyStatus.countDocuments({
        user: user,
        date: todayDateTime
    });
    if (countIfAlreadyStarted > 0) {
        return response.success("Timer is already started", null, res);
    } else {
        tasks = tasks.map((e) => {
            e._id = new mongoose.Types.ObjectId();
            return e;
        });
        await models.DailyStatus.create({
            user: user,
            date: todayDateTime,
            startTime: currentDateTime,
            tasks: tasks,
        });
        return response.success("Timer started", true, res);
    }
});

exports.stopTimer = asyncHandler(async (req, res) => {
    const { id } = req.body;
    let result = await models.DailyStatus.findById(id).populate('user').lean();
    let currentDate = moment().toDate();

    // Check for late End Day marking
    let isLateMarking = false;
    let lateMarkingMessage = "";

    if (result.user) {
        const currentHour = moment().hour();
        const workType = result.user.workType;

        if (workType === 'remote') {
            if (currentHour >= 7 && currentHour < 16) {
                isLateMarking = true;
                lateMarkingMessage = `Late End Day at ${moment().format('h:mm A')}. Normal remote session ends by 7:00 AM.`;
            }
        } else if (workType === 'onsite') {
            const sessionStartDay = moment(result.date).tz('Asia/Kolkata').format('YYYY-MM-DD');
            const sessionEndDay = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
            if (sessionStartDay !== sessionEndDay) {
                isLateMarking = true;
                lateMarkingMessage = `Late End Day at ${moment().format('MMM D, h:mm A')}. Session ended on a different day than it started.`;
            }
        }
    }

    result.tasks = result.tasks.map((v) => {
        v.isTrackerStarted = false;
        v.endedTime = currentDate
        return v;
    })

    await models.DailyStatus.findByIdAndUpdate(id, { endTime: moment().toDate(), tasks: result.tasks }, { new: true });

    return response.success(
        isLateMarking ? lateMarkingMessage : "Timer stopped successfully",
        { success: true, isLateMarking, lateMarkingMessage },
        res
    );
});

exports.getHistory = asyncHandler(async (req, res) => {
    const { selectedMonth, selectedUserId } = req.body;
    let userId = selectedUserId || req.userId;
    const givenDate = moment.utc(selectedMonth).tz('Asia/Kolkata');
    const firstDate = givenDate.clone().startOf('month').toDate();
    const lastDate = givenDate.clone().endOf('month').toDate();
    let histories = await models.DailyStatus.find({
        user: userId,
        $and: [
            { date: { $gte: firstDate } },
            { date: { $lte: lastDate } },
        ]
    }).sort({ _id: -1 }).lean();

    histories = histories.map((v) => {
        const timezone = 'Asia/Kolkata';
        // IMPORTANT: Use startTime or date (Start Day) for rawDate calculation
        // This ensures tasks are ALWAYS shown on their creation date (Start Day)
        // NOT on End Day date, even if End Day is next day (e.g., remote users 4 PM - 1 AM)
        const dateSource = v.startTime || v.date;
        const rawDateMoment = dateSource ? moment.utc(dateSource).tz(timezone) : null;
        v.rawDate = rawDateMoment ? rawDateMoment.format('YYYY-MM-DD') : '';
        v.startTimeValue = v.startTime ? moment.utc(v.startTime).tz(timezone).format('HH:mm') : '';
        v.endTimeValue = v.endTime ? moment.utc(v.endTime).tz(timezone).format('HH:mm') : '';
        v.date = rawDateMoment ? rawDateMoment.format('MMM D, YYYY') : '-';
        v.startTime = v.startTime ? moment.utc(v.startTime).tz(timezone).format('h:mm A') : '-';
        if (v.endTime) {
            const startDayStr = moment.utc(v.startTime || v.date).tz(timezone).format('YYYY-MM-DD');
            const endMoment = moment.utc(v.endTime).tz(timezone);
            const endDayStr = endMoment.format('YYYY-MM-DD');

            if (startDayStr === endDayStr) {
                v.endTime = endMoment.format('h:mm A');
            } else {
                v.endTime = endMoment.format('MMM D, h:mm A');
            }
        } else {
            v.endTime = '-';
        }
        return v;
    });
    return response.success("Fetched history", histories, res);
});

exports.addBackdatedTask = asyncHandler(async (req, res) => {
    const { date, startTime, endTime, tasks = [], userId } = req.body;
    let targetUserId = req.userId;

    if (!date || !Array.isArray(tasks)) {
        return response.success("Date and tasks are required", null, res);
    }

    if (['superAdmin', 'hr', 'admin'].includes(req.userRole) && userId) {
        targetUserId = userId;
    } else if (userId && String(userId) !== String(req.userId)) {
        return response.success("You are not allowed to add tasks for another user", null, res);
    }

    const timezone = 'Asia/Kolkata';
    let parsedDate = moment.tz(date, 'YYYY-MM-DD', true, timezone);
    if (!parsedDate.isValid()) {
        return response.success("Invalid date format", null, res);
    }

    let startDateTime = startTime ? moment.tz(`${date} ${startTime}`, 'YYYY-MM-DD HH:mm', true, timezone) : null;
    let endDateTime = endTime ? moment.tz(`${date} ${endTime}`, 'YYYY-MM-DD HH:mm', true, timezone) : null;

    // Validate date/time formats
    if (startTime && (!startDateTime || !startDateTime.isValid())) {
        return response.success("Invalid start time format", null, res);
    }
    if (endTime && (!endDateTime || !endDateTime.isValid())) {
        return response.success("Invalid end time format", null, res);
    }

    const sanitizedTasks = tasks
        .map((task) => typeof task === 'string' ? task.trim() : '')
        .filter((task) => task.length > 0);

    if (sanitizedTasks.length === 0) {
        return response.success("Please provide at least one valid task", null, res);
    }

    // Convert to UTC for MongoDB date comparison (matching pattern from getTodaysData)
    // Use UTC conversion to ensure proper date matching in MongoDB
    const startOfDay = parsedDate.clone().startOf('day').toDate();
    const endOfDay = parsedDate.clone().endOf('day').toDate();

    let dailyStatus = await models.DailyStatus.findOne({
        user: targetUserId,
        date: { $gte: startOfDay, $lte: endOfDay }
    });

    const tasksToInsert = sanitizedTasks.map((taskDescription) => ({
        _id: new mongoose.Types.ObjectId(),
        task: taskDescription,
        assignedTo: targetUserId,
        assignedBy: req.userId,
        status: 'not-started',
        priority: 'medium',
        isTrackerStarted: false,
        initalStartedTime: null,
        lastStartedTime: null,
        endedTime: null,
        countView: "00:00:00",
        totalSeconds: 0,
        estimatedTime: { hour: "0", minutes: "15" },
        carriedOver: false
    }));

    if (!dailyStatus) {
        if (!startDateTime || !endDateTime || !endDateTime.isAfter(startDateTime)) {
            return response.success("Valid start and end times are required for new days", null, res);
        }
        dailyStatus = await models.DailyStatus.create({
            user: targetUserId,
            date: startOfDay,
            startTime: startDateTime.toDate(),
            endTime: endDateTime.toDate(),
            tasks: tasksToInsert
        });
    } else {
        // Update startTime if not set or if new startTime is provided and earlier
        if (startDateTime) {
            if (!dailyStatus.startTime || moment.tz(dailyStatus.startTime, timezone).isAfter(startDateTime)) {
                dailyStatus.startTime = startDateTime.toDate();
            }
        }
        // Update endTime if not set or if new endTime is provided and later
        if (endDateTime) {
            // Get the final startTime value (after potential update above)
            const finalStartTime = dailyStatus.startTime;
            if (finalStartTime && !endDateTime.isAfter(moment.tz(finalStartTime, timezone))) {
                return response.success("End time must be after start time", null, res);
            }
            if (!dailyStatus.endTime ||
                (finalStartTime && moment.tz(dailyStatus.endTime, timezone).isBefore(endDateTime))) {
                dailyStatus.endTime = endDateTime.toDate();
            }
        }
        // Final validation: ensure endTime is after startTime if both exist
        if (dailyStatus.startTime && dailyStatus.endTime) {
            if (!moment.tz(dailyStatus.endTime, timezone).isAfter(moment.tz(dailyStatus.startTime, timezone))) {
                return response.success("End time must be after start time", null, res);
            }
        }
        // Ensure date is set
        if (!dailyStatus.date) {
            dailyStatus.date = startOfDay;
        }
        dailyStatus.tasks = dailyStatus.tasks.concat(tasksToInsert);
        await dailyStatus.save();
    }

    return response.success("Backdated tasks added successfully", dailyStatus, res);
});

exports.generateReport = async (req, res) => {
    try {
        const { selectedMonth, selectedYear, workType } = req.body;
        const timezone = 'Asia/Kolkata';
        const reportYear = selectedYear || moment().year();
        const givenDate = moment(`${reportYear}-${selectedMonth}`, 'YYYY-M');
        const firstDate = givenDate.clone().startOf('month').toDate();
        const lastDate = givenDate.clone().endOf('month').toDate();

        const workbook = xlsx.utils.book_new();

        // Generate date range for the selected month using moment
        const year = givenDate.year();
        const month = givenDate.month() + 1;
        const daysInMonth = givenDate.daysInMonth();

        // Create date range using moment
        const dateRange = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = givenDate.clone().date(day);
            dateRange.push(currentDate.format('YYYY-MM-DD'));
        }

        // GET USERS TO CREATE SHEET
        let users = await models.User.find({ isActive: true, role: { $nin: ["superAdmin", "hr", "admin"] }, workType: workType || "remote" }).lean();

        for (let i = 0; i < users.length; i++) {
            let results = await models.DailyStatus.find({
                user: users[i]._id,
                $and: [
                    { date: { $gte: firstDate } },
                    { date: { $lte: lastDate } },
                ]
            }).lean();

            // Parse dates using moment
            const records = results.map(entry => ({
                date: entry.date ? moment.utc(entry.date).tz(timezone).format('YYYY-MM-DD') : null,
                startTime: entry.startTime ? moment.utc(entry.startTime).tz(timezone) : null,
                endTime: entry.endTime ? moment.utc(entry.endTime).tz(timezone) : null,
                tasks: Array.isArray(entry.tasks)
                    ? entry.tasks
                        .map(task => task?.task)
                        .filter(Boolean)
                    : []
            })).filter(record => record.date);

            // Prepare data for Excel
            let totalWorkingDays = 0;
            let actualWorkingDays = 0;

            const excelData = dateRange.map((date, index) => {
                const record = records.find(r => String(r.date) === String(date));
                const hasStartTime = record ? record.startTime ? true : false : false;
                const hasEndTime = record ? record.endTime ? true : false : false;
                let tasksSummary = '';
                if (record && record.tasks && record.tasks.length) {
                    tasksSummary = record.tasks.join('\n');
                }

                // Get day name from date using moment
                const dateObj = moment.tz(date, 'YYYY-MM-DD', timezone);
                const dayName = dateObj.format('dddd');
                const isWeekend = dayName === 'Sunday';

                // Count working days (excluding weekends)
                // ATTENDANCE LOGIC: Based on Start Day ONLY
                // - hasStartTime = user clicked "Start Day" = PRESENT for that date
                // - hasEndTime = user clicked "End Day" = session completed
                if (!isWeekend) {
                    totalWorkingDays++;
                    // Attendance is marked if they started the day, regardless of end day
                    if (hasStartTime) {
                        actualWorkingDays++;
                    }
                }

                let remark = '';
                let endTimeDisplay = '';
                if (hasEndTime) {
                    const startDayStr = date; // 'YYYY-MM-DD'
                    const endMoment = record.endTime;
                    const endDayStr = endMoment.format('YYYY-MM-DD');

                    if (startDayStr === endDayStr) {
                        endTimeDisplay = endMoment.format('h:mm A');
                    } else {
                        endTimeDisplay = endMoment.format('MMM D, h:mm A');
                        if (users[i].workType === 'remote') {
                            if (endMoment.hour() >= 7) remark = 'Late End Day';
                        } else {
                            remark = 'Late End Day';
                        }
                    }
                } else if (hasStartTime) {
                    remark = 'EOD Missing';
                }

                return {
                    'SRNO': index + 1,
                    'DATE': date,
                    'DAY': dayName,
                    'WORK STATUS': hasStartTime && hasEndTime ? 'Worked' : 'Not Worked',
                    'START TIME': hasStartTime ? record.startTime.format('h:mm A') : '',
                    'END TIME': endTimeDisplay,
                    'TASKS': tasksSummary || '-',
                    'REMARK': remark,
                };
            });

            // Add summary rows
            excelData.push(
                {}, // Empty row for separation
                {
                    'SRNO': '',
                    'DATE': 'SUMMARY',
                    'DAY': '',
                    'WORK STATUS': '',
                    'START TIME': '',
                    'END TIME': '',
                    'TASKS': '',
                    'REMARK': ''
                },
                {
                    'SRNO': '',
                    'DATE': 'Total Working Days (excl. weekends)',
                    'DAY': totalWorkingDays,
                    'WORK STATUS': '',
                    'START TIME': '',
                    'END TIME': '',
                    'TASKS': '',
                    'REMARK': ''
                },
                {
                    'SRNO': '',
                    'DATE': 'Actual Working Days',
                    'DAY': actualWorkingDays,
                    'WORK STATUS': '',
                    'START TIME': '',
                    'END TIME': '',
                    'TASKS': '',
                    'REMARK': ''
                },
                {
                    'SRNO': '',
                    'DATE': 'Attendance Percentage',
                    'DAY': totalWorkingDays > 0 ? `${Math.round((actualWorkingDays / totalWorkingDays) * 100)}%` : '0%',
                    'WORK STATUS': '',
                    'START TIME': '',
                    'END TIME': '',
                    'TASKS': '',
                    'REMARK': ''
                }
            );

            const worksheet = xlsx.utils.json_to_sheet(excelData, {
                header: ['SRNO', 'DATE', 'DAY', 'WORK STATUS', 'START TIME', 'END TIME', 'TASKS', 'REMARK'],
                skipHeader: false
            });

            // Force wrap text for TASKS column so every task appears on its own line
            if (worksheet['!ref']) {
                const range = xlsx.utils.decode_range(worksheet['!ref']);
                for (let row = range.s.r + 1; row <= range.e.r; row++) {
                    const cellAddress = xlsx.utils.encode_cell({ r: row, c: 4 }); // column E (TASKS)
                    const cell = worksheet[cellAddress];
                    if (cell && cell.v) {
                        cell.s = cell.s || {};
                        cell.s.alignment = Object.assign({}, cell.s.alignment, { wrapText: true });
                    }
                }
            }

            // Add column styling and width
            // SRNO width 5
            const cols = [
                { wch: 5, s: { alignment: { horizontal: 'center', vertical: 'center' } } },   // SRNO
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // DATE
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // DAY
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // WORK STATUS
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // START TIME
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // END TIME
                { wch: 80, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // TASKS
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } }   // REMARK
            ];
            worksheet['!cols'] = cols;
            xlsx.utils.book_append_sheet(workbook, worksheet, users[i].name.substring(0, 30)); // Limit sheet name length
        }

        const fileName = `itf_work_status_${month}_${year}.xlsx`;

        // Write to buffer and send response
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set headers properly
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.send(buffer);

    } catch (error) {
        console.error('Error generating Excel file:', error);
        res.status(500).json({
            error: 'Error generating Excel file',
            message: error.message
        });
    }
}

exports.getReportData = asyncHandler(async (req, res) => {
    try {
        const { selectedMonth, workType } = req.body;

        // Parse the selectedMonth with proper format
        const givenDate = moment(selectedMonth, 'YYYY-MM-DD');
        const firstDate = givenDate.clone().startOf('month').toDate();
        const lastDate = givenDate.clone().endOf('month').toDate();

        // Generate date range for the selected month
        const year = givenDate.year();
        const month = givenDate.month() + 1;
        const startDate = DateTime.fromObject({ year, month, day: 1 });
        const endDate = startDate.endOf('month');
        const daysInMonth = endDate.day;
        const dateRange = Array.from({ length: daysInMonth }, (_, i) => startDate.plus({ days: i }).toISODate());

        // GET USERS TO CREATE DATA
        let users = await models.User.find({ isActive: true, role: { $nin: ["superAdmin", "hr", "admin"] }, workType: workType || "remote" });

        const reportData = [];

        for (let i = 0; i < users.length; i++) {
            let results = await models.DailyStatus.find({
                user: users[i]._id,
                $and: [
                    { date: { $gte: firstDate } },
                    { date: { $lte: lastDate } },
                ]
            }).lean();

            // Parse dates and create a map for quick lookup
            const recordsMap = {};
            results.forEach(entry => {
                if (entry.date) {
                    const dateKey = DateTime.fromJSDate(new Date(entry.date)).toISODate();
                    recordsMap[dateKey] = {
                        startTime: entry.startTime,
                        endTime: entry.endTime
                    };
                }
            });

            // Calculate working days
            let totalWorkingDays = 0;
            let actualWorkingDays = 0;

            dateRange.forEach((date) => {
                const dateObj = DateTime.fromISO(date);
                const dayName = dateObj.toFormat('EEEE');
                const isWeekend = dayName === 'Sunday';

                // Count working days (excluding weekends)
                // ATTENDANCE LOGIC: Based on Start Day ONLY
                if (!isWeekend) {
                    totalWorkingDays++;

                    // Check if user worked on this day (Present = Started)
                    const record = recordsMap[date];
                    if (record && record.startTime) {
                        actualWorkingDays++;
                    }
                }
            });

            // Add summary data
            const summary = {
                totalWorkingDays: totalWorkingDays,
                actualWorkingDays: actualWorkingDays,
                attendancePercentage: totalWorkingDays > 0 ? Math.round((actualWorkingDays / totalWorkingDays) * 100) : 0
            };

            reportData.push({
                user: {
                    id: users[i]._id,
                    name: users[i].name,
                    email: users[i].email,
                    mobile: users[i].mobile,
                    jobTitle: users[i].jobTitle,
                    workType: users[i].workType
                },
                summary: summary
            });
        }

        return response.success("Report data fetched successfully", reportData, res);
    } catch (error) {
        console.error('Error fetching report data:', error);
        return response.error("Error fetching report data", error.message, res);
    }
});

exports.getDailyAttendanceList = asyncHandler(async (req, res) => {
    try {
        const { startDate, endDate, workType, userId } = req.body;
        const timezone = 'Asia/Kolkata';

        const start = moment.tz(startDate, timezone).startOf('day').toDate();
        const end = moment.tz(endDate, timezone).endOf('day').toDate();

        let userQuery = { isActive: true, role: { $nin: ['superAdmin', 'hr', 'admin'] } };
        if (workType) userQuery.workType = workType;
        if (userId) userQuery._id = userId;

        const users = await models.User.find(userQuery).select('name email workType').lean();
        const attendanceRecords = await models.DailyStatus.find({
            date: { $gte: start, $lte: end },
            user: { $in: users.map(u => u._id) }
        }).lean();

        const results = [];
        const daysCount = moment(endDate).diff(moment(startDate), 'days') + 1;

        for (let i = 0; i < daysCount; i++) {
            const currentDay = moment(startDate).add(i, 'days').format('YYYY-MM-DD');
            const dayStart = moment.tz(currentDay, timezone).startOf('day').toDate();

            for (const user of users) {
                const record = attendanceRecords.find(r =>
                    String(r.user) === String(user._id) &&
                    moment(r.date).tz(timezone).format('YYYY-MM-DD') === currentDay
                );

                const startMoment = record && record.startTime ? moment(record.startTime).tz(timezone) : null;
                const endMoment = record && record.endTime ? moment(record.endTime).tz(timezone) : null;

                let outTimeFormatted = '-';
                let isLateEndDay = false;

                if (endMoment) {
                    const sessionStartDay = moment(record.date).tz(timezone).format('YYYY-MM-DD');
                    const sessionEndDay = endMoment.format('YYYY-MM-DD');

                    if (sessionStartDay === sessionEndDay) {
                        // Same Day: Show just time, never late
                        outTimeFormatted = endMoment.format('h:mm A');
                        isLateEndDay = false;
                    } else {
                        // Different Day: Show Date + Time
                        outTimeFormatted = endMoment.format('MMM D, h:mm A');
                        if (user.workType === 'remote') {
                            isLateEndDay = endMoment.hour() >= 7;
                        } else {
                            // Onsite different day is always late
                            isLateEndDay = true;
                        }
                    }
                }

                results.push({
                    date: moment(currentDay).format('MMM D, YYYY'),
                    rawDate: currentDay,
                    user: user,
                    status: record && record.startTime ? 'PRESENT' : (moment(currentDay).format('dddd') === 'Sunday' ? 'WEEKEND' : 'ABSENT'),
                    inTime: record && record.startTime ? moment(record.startTime).tz(timezone).format('h:mm A') : '-',
                    outTime: outTimeFormatted,
                    isLateEndDay: isLateEndDay,
                    type: user.workType.toUpperCase(),
                    tasks: record ? record.tasks : []
                });
            }
        }

        // Sort by date descending
        results.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));

        return response.success("Attendance list fetched", results, res);
    } catch (error) {
        console.error('Error fetching attendance list:', error);
        return response.error("Error fetching attendance list", error.message, res);
    }
});

exports.markManualAttendance = asyncHandler(async (req, res) => {
    try {
        const { userId, date, startTime, endTime } = req.body;
        const timezone = 'Asia/Kolkata';

        if (!userId || !date || !startTime) {
            return response.error("Missing required fields", null, res);
        }

        const targetDate = moment.tz(date, timezone).startOf('day').toDate();
        const startDateTime = moment.tz(`${date} ${startTime}`, 'YYYY-MM-DD HH:mm', timezone).toDate();
        const endDateTime = endTime ? moment.tz(`${date} ${endTime}`, 'YYYY-MM-DD HH:mm', timezone).toDate() : null;

        let record = await models.DailyStatus.findOne({ user: userId, date: targetDate });

        const manualTask = {
            _id: new mongoose.Types.ObjectId(),
            task: "Manually marked attendance",
            status: 'completed',
            priority: 'medium',
            isTrackerStarted: false,
            totalSeconds: 0,
            countView: "00:00:00"
        };

        if (record) {
            record.startTime = startDateTime;
            if (endDateTime) record.endTime = endDateTime;
            record.tasks.push(manualTask);
            await record.save();
        } else {
            await models.DailyStatus.create({
                user: userId,
                date: targetDate,
                startTime: startDateTime,
                endTime: endDateTime,
                tasks: [manualTask]
            });
        }

        return response.success("Attendance marked manually", true, res);
    } catch (error) {
        console.error('Error marking manual attendance:', error);
        return response.error("Error marking manual attendance", error.message, res);
    }
});

exports.getAllUsersDailyAttendance = asyncHandler(async (req, res) => {
    try {
        const { selectedMonth } = req.body;
        const timezone = 'Asia/Kolkata';
        const givenDate = moment(selectedMonth).tz(timezone);
        const firstDate = givenDate.clone().startOf('month').toDate();
        const lastDate = givenDate.clone().endOf('month').toDate();

        const daysInMonth = givenDate.daysInMonth();
        const dateRange = [];
        for (let day = 1; day <= daysInMonth; day++) {
            dateRange.push(givenDate.clone().date(day).format('YYYY-MM-DD'));
        }

        const users = await models.User.find({ isActive: true, role: { $nin: ['superAdmin', 'hr', 'admin'] } }).select('name email workType').lean();
        const attendanceData = await models.DailyStatus.find({
            date: { $gte: firstDate, $lte: lastDate }
        }).lean();

        const report = users.map(user => {
            const userAttendance = {};
            dateRange.forEach(date => {
                const record = attendanceData.find(a =>
                    String(a.user) === String(user._id) &&
                    moment(a.date).tz(timezone).format('YYYY-MM-DD') === date
                );

                const isWeekend = moment(date).format('dddd') === 'Sunday';
                if (isWeekend) {
                    userAttendance[date] = 'Weekend';
                } else {
                    userAttendance[date] = record && record.startTime ? 'Present' : 'Absent';
                }
            });

            return {
                user: user,
                attendance: userAttendance
            };
        });

        return response.success("Daily attendance fetched", { report, dateRange }, res);
    } catch (error) {
        console.error('Error fetching daily attendance:', error);
        return response.error("Error fetching daily attendance", error.message, res);
    }
});
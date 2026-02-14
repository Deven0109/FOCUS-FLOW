const jwt = require('jsonwebtoken');
const { DailyStatus, Task, User } = require('./../models/zindex');

exports.updateDailyStatus = async (userId, taskId, status) => {
    const today = new Date().setHours(0, 0, 0, 0);

    let dailyStatus = await DailyStatus.findOne({
        user: userId,
        date: { $gte: today }
    });

    if (!dailyStatus) {
        dailyStatus = new DailyStatus({
            user: userId,
            date: new Date()
        });
    }

    // Find or create task in daily status
    let taskStatus = dailyStatus.tasks.find(t => t.task.equals(taskId));
    if (!taskStatus) {
        taskStatus = { task: taskId, statusUpdates: [] };
        dailyStatus.tasks.push(taskStatus);
    }

    taskStatus.statusUpdates.push({ status });
    await dailyStatus.save();
}

exports.generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: `${process.env.JWT_EXPIRES_IN_DAYS}d`,
    });
};


exports.formatTime = (sTime, eTime) => {
    const startTime = new Date(sTime);
    const endTime = new Date(eTime);
    const diffInSeconds = Math.floor((endTime - startTime.getTime()) / 1000);
    let seconds = diffInSeconds;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    let result = '';
    if (hours > 0) {
        result += `${hours}h `;
    }
    if (minutes > 0 || hours > 0) {
        result += `${minutes}m `;
    }
    result += `${secs}s`;
    return result.trim();
};
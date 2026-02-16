const Notification = require('../models/notification');
const User = require('../models/users');
const { sendNotification } = require('./socket');
const mongoose = require('mongoose');

/**
 * PRODUCTION-LEVEL NOTIFICATION HELPER
 * Ensures a single notification document is created with a rich receivers array.
 */
const createNotification = async ({ title, message, type, sender, receivers, workType, module, referenceId, priority = "Medium" }) => {
    try {
        let finalReceivers = [];

        // 1. Resolve recipients
        if (receivers && receivers.length > 0) {
            finalReceivers = Array.isArray(receivers) ? receivers : [receivers];
        } else if (workType) {
            const query = { isActive: true };
            if (workType !== 'all') {
                query.workType = workType;
            }
            const users = await User.find(query).select('_id');
            finalReceivers = users.map(u => u._id);
        }

        if (finalReceivers.length === 0) return;

        // 2. EXCLUDE SENDER
        // Prevents the trigger user from receiving alerts for their own events
        if (sender) {
            const senderIdStr = sender.toString();
            finalReceivers = finalReceivers.filter(id => id.toString() !== senderIdStr);
        }

        if (finalReceivers.length === 0) return;

        // 3. PREPARE PER-USER OBJECTS
        // Every recipient gets their own status set within the main document
        const receiversArray = finalReceivers.map(id => ({
            user: new mongoose.Types.ObjectId(id),
            isRead: false,
            isDeleted: false
        }));

        // 4. PERSIST TO DATABASE
        const notification = new Notification({
            title,
            message,
            type,
            sender: new mongoose.Types.ObjectId(sender),
            receivers: receiversArray,
            workType: workType || "all",
            module,
            referenceId: new mongoose.Types.ObjectId(referenceId),
            priority
        });

        await notification.save();

        // 5. BROADCAST VIA SOCKET
        // Sends individual "Unread" snapshots to every connected client
        finalReceivers.forEach(receiverId => {
            const userSpecificData = notification.toObject();
            userSpecificData.isRead = false; // Initial real-time state
            delete userSpecificData.receivers; // Privacy check

            sendNotification(receiverId, userSpecificData);
        });

        return notification;
    } catch (error) {
        console.error("PER-USER NOTIFICATION ERROR:", error);
    }
};

module.exports = {
    createNotification
};

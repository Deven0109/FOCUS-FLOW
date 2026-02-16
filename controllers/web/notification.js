const Notification = require('../../models/notification');
const asyncHandler = require('express-async-handler');
const response = require('../../utils/response');
const mongoose = require('mongoose');

/**
 * 1. GET NOTIFICATIONS
 * Fetches notifications for the logged-in user and extracts their private isRead status.
 */
exports.getNotifications = asyncHandler(async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const { page = 1, limit = 10, type } = req.query;

    const query = {
        receivers: {
            $elemMatch: {
                user: userId,
                isDeleted: false
            }
        }
    };

    if (type) {
        query.type = type;
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: { path: 'sender', select: 'name profileImage' }
    };

    const notifications = await Notification.paginate(query, options);

    // Prepare response: Flatten the user's specific status to the top level
    const formattedDocs = notifications.docs.map(doc => {
        const docObj = doc.toObject();
        // Find THIS user's entry in the shared receivers array
        const myStatus = (docObj.receivers || []).find(r => r.user.toString() === userId.toString());

        docObj.isRead = myStatus ? myStatus.isRead : false;

        // PRIVACY: Never expose other users' statuses or the full receivers list to the frontend
        delete docObj.receivers;
        return docObj;
    });

    // 2. COUNT UNREAD
    // Strictly counts only items where THIS user has not yet read the message
    const unreadCount = await Notification.countDocuments({
        receivers: {
            $elemMatch: {
                user: userId,
                isRead: false,
                isDeleted: false
            }
        }
    });

    return res.status(200).json({
        success: true,
        data: formattedDocs,
        totalDocs: notifications.totalDocs,
        totalPages: notifications.totalPages,
        page: notifications.page,
        unreadCount
    });
});

/**
 * 3. MARK AS READ
 * Uses MongoDB positional operator ($) to update ONLY the matching user's status.
 */
exports.markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = new mongoose.Types.ObjectId(req.userId);

    const notification = await Notification.findOneAndUpdate(
        {
            _id: id,
            "receivers.user": userId
        },
        {
            $set: { "receivers.$.isRead": true }
        },
        { new: true }
    );

    if (!notification) {
        return response.notFound(res);
    }

    // Clean response
    const docObj = notification.toObject();
    const myStatus = docObj.receivers.find(r => r.user.toString() === userId.toString());
    docObj.isRead = myStatus ? myStatus.isRead : true;
    delete docObj.receivers;

    return response.success("Notification marked as read", docObj, res);
});

/**
 * 4. MARK ALL AS READ
 * Targets multiple documents but updates only the specified user's array elements.
 */
exports.markAllAsRead = asyncHandler(async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.userId);

    await Notification.updateMany(
        {
            receivers: {
                $elemMatch: {
                    user: userId,
                    isRead: false
                }
            }
        },
        {
            $set: { "receivers.$[elem].isRead": true }
        },
        {
            arrayFilters: [{ "elem.user": userId, "elem.isRead": false }]
        }
    );

    return response.success("All notifications marked as read", null, res);
});

/**
 * 5. SOFT DELETE
 * Hides the notification for the current user without affecting others.
 */
exports.deleteNotification = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = new mongoose.Types.ObjectId(req.userId);

    const notification = await Notification.findOneAndUpdate(
        {
            _id: id,
            "receivers.user": userId
        },
        {
            $set: { "receivers.$.isDeleted": true }
        },
        { new: true }
    );

    if (!notification) {
        return response.notFound(res);
    }

    return response.success("Notification deleted successfully", null, res);
});

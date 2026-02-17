const express = require('express');
const router = express.Router();

const timerCtrl = require('./../controllers/web/timer');
const authCtrl = require('./../controllers/web/authentication');
const projectCtrl = require('./../controllers/web/project');
const ticketCtrl = require('./../controllers/web/tickets');
const usersCtrl = require('./../controllers/web/users');
const documentsCtrl = require('./../controllers/web/documents');
const noticeCtrl = require('./../controllers/web/notice');
const leaveCtrl = require('./../controllers/web/leave');
const notificationCtrl = require('./../controllers/web/notification');
const { authMiddleware, adminCheck, hrOnlyCheck, hrOrDeveloperCheck } = require('./../middleware/auth_middleware');
const { checkRBAC } = require('./../middleware/rbacMiddleware');
const uploader = require('./../utils/aws_upload').uploadToAWS;
const uploadDocumentsLocal = require('./../utils/aws_upload').uploadDocumentsLocal;
const { uploadNoticeFile } = require('./../utils/notice_upload');

router.post("/signIn", authCtrl.signIn);
router.post("/getDashboard", authMiddleware, authCtrl.getDashboard);
router.post("/getDeveloperReport", authMiddleware, authCtrl.getDeveloperReport);
router.post("/saveUser", authMiddleware, checkRBAC(), authCtrl.saveUser);
router.post("/users", authMiddleware, adminCheck, authCtrl.getUsers);
router.post("/getAllUsers", authMiddleware, adminCheck, authCtrl.getAllUsers);
router.post("/changePassword", authMiddleware, authCtrl.changePassword);
router.post("/toggleAccountStatus", authMiddleware, checkRBAC('canEdit'), authCtrl.toggleAccountStatus);
router.post("/deleteUserAccount", authMiddleware, checkRBAC('canDelete'), authCtrl.deleteUserAccount);


router.post("/getProfile", authMiddleware, authCtrl.getProfile);
router.post("/updateProfileImage", authMiddleware, uploader("profileImages").single('file'), authCtrl.updateProfileImage);
router.post("/getAssignedTasks", authMiddleware, timerCtrl.getAssignedTasks);
router.post("/getPreviousPendingTasks", authMiddleware, timerCtrl.getPreviousPendingTasks);

router.post("/getTodaysData", authMiddleware, timerCtrl.getTodaysData);
router.post("/updateTasks", authMiddleware, timerCtrl.updateTasks);
router.post("/updateTaskTimer", authMiddleware, timerCtrl.updateTaskTimer);
router.post("/startTimer", authMiddleware, timerCtrl.startTimer);
router.post("/stopTimer", authMiddleware, timerCtrl.stopTimer);
router.post("/addBackdatedTask", authMiddleware, timerCtrl.addBackdatedTask);

router.post("/taskHistory", authMiddleware, timerCtrl.getHistory);
router.post("/generateReport", authMiddleware, adminCheck, timerCtrl.generateReport);
router.post("/getEmployeesAttendanceData", timerCtrl.getReportData);
router.post("/getAllUsersDailyAttendance", authMiddleware, adminCheck, timerCtrl.getAllUsersDailyAttendance);
router.post("/getDailyAttendanceList", authMiddleware, adminCheck, timerCtrl.getDailyAttendanceList);
router.post("/markManualAttendance", authMiddleware, adminCheck, timerCtrl.markManualAttendance);

router.post("/getProjects", authMiddleware, adminCheck, projectCtrl.getProjects);
router.post("/saveProjects", authMiddleware, adminCheck, projectCtrl.saveProjects);
router.post("/deleteProjects", authMiddleware, adminCheck, projectCtrl.deleteProject);

router.post("/getTickets", authMiddleware, ticketCtrl.getTickets);
router.post("/saveTickets", authMiddleware, ticketCtrl.saveTickets);
router.post("/updateTickets", authMiddleware, ticketCtrl.updateTickets);
router.post("/deleteTicket", authMiddleware, adminCheck, ticketCtrl.deleteTicket);

router.post("/documents/list", authMiddleware, documentsCtrl.list);
router.post("/documents/upload", authMiddleware, adminCheck, function (req, res, next) {
    uploadDocumentsLocal().single('file')(req, res, function (err) {
        if (err) {
            return res.status(400).json({ message: err.message || 'Only PDF files are allowed', data: null, status: 400 });
        }
        next();
    });
}, documentsCtrl.upload);
router.post("/documents/delete", authMiddleware, adminCheck, documentsCtrl.remove);
router.get("/documents/download/:id", authMiddleware, documentsCtrl.download);

// Notice Board routes
router.post("/notices", authMiddleware, hrOrDeveloperCheck, noticeCtrl.getNotices);
router.post("/notice/create", authMiddleware, hrOnlyCheck, uploadNoticeFile().single('file'), noticeCtrl.createNotice);
router.post("/notice/update", authMiddleware, hrOnlyCheck, uploadNoticeFile().single('file'), noticeCtrl.updateNotice);
router.post("/notice/delete", authMiddleware, hrOnlyCheck, noticeCtrl.deleteNotice);
router.post("/notice/view", authMiddleware, hrOrDeveloperCheck, noticeCtrl.viewNotice);
router.post("/notice/employees", authMiddleware, hrOnlyCheck, noticeCtrl.getEmployeesByWorkType);

// Calendar/Leave API routes (mounted at /api in app.js)
// Calendar/Leave API routes (mounted at /api in app.js) -- verify prefix logic in app.js
router.get("/leaves", authMiddleware, leaveCtrl.getAllLeaves);
router.get("/leaves/pending", authMiddleware, adminCheck, leaveCtrl.getPendingLeaves); // New: HR Dashboard
router.put("/leaves/status", authMiddleware, adminCheck, leaveCtrl.updateLeaveStatus); // New: Approve/Reject
router.post("/leaves", authMiddleware, leaveCtrl.createLeave);
router.get("/leaves/me", authMiddleware, leaveCtrl.getUserLeaves);
router.delete("/leaves/:id", authMiddleware, leaveCtrl.deleteLeave);

// Notification routes
router.get("/notifications", authMiddleware, notificationCtrl.getNotifications);
router.put("/notifications/:id/read", authMiddleware, notificationCtrl.markAsRead);
router.put("/notifications/read-all", authMiddleware, notificationCtrl.markAllAsRead);
router.delete("/notifications/:id", authMiddleware, notificationCtrl.deleteNotification);

module.exports = router;

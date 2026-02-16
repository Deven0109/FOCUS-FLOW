const BASE_URL = window.location.origin;
const endpoints = {
    LOGIN: `${BASE_URL}/users/signIn`,
    GET_DASHBOARD: `${BASE_URL}/users/getDashboard`,
    UPDATE_TASK_TIMER: `${BASE_URL}/users/updateTaskTimer`,
    CHANGE_PASSWORD: `${BASE_URL}/users/changePassword`,
    GET_PROFILE: `${BASE_URL}/users/getProfile`,
    GET_TODAYS_DATA: `${BASE_URL}/users/getTodaysData`,
    UPDATE_TASKS: `${BASE_URL}/users/updateTasks`,
    START_TIMER: `${BASE_URL}/users/startTimer`,
    STOP_TIMER: `${BASE_URL}/users/stopTimer`,
    TASK_HISTORY: `${BASE_URL}/users/taskHistory`,
    GET_USERS: `${BASE_URL}/users/users`,
    GET_ALL_USERS: `${BASE_URL}/users/getAllUsers`,
    SAVE_USER: `${BASE_URL}/users/saveUser`,
    GENERATE_REPORT: `${BASE_URL}/users/generateReport`,
    ADD_BACKDATED_TASK: `${BASE_URL}/users/addBackdatedTask`,
    GET_PREVIOUS_TASKS: `${BASE_URL}/users/getPreviousPendingTasks`,
    GET_DEVELOPER_REPORT: `${BASE_URL}/users/getDeveloperReport`,
    TOGGLE_ACCOUNT_STATUS: `${BASE_URL}/users/toggleAccountStatus`,
    DELETE_USER_ACCOUNT: `${BASE_URL}/users/deleteUserAccount`,
    UPLOAD_PROFILE_IMAGE: `${BASE_URL}/users/updateProfileImage`,
    DOCUMENTS_LIST: `${BASE_URL}/users/documents/list`,
    DOCUMENTS_UPLOAD: `${BASE_URL}/users/documents/upload`,
    DOCUMENTS_DELETE: `${BASE_URL}/users/documents/delete`,
    DOCUMENTS_DOWNLOAD: `${BASE_URL}/users/documents/download`,
    NOTICES_LIST: `${BASE_URL}/users/notices`,
    NOTICE_CREATE: `${BASE_URL}/users/notice/create`,
    NOTICE_UPDATE: `${BASE_URL}/users/notice/update`,
    NOTICE_DELETE: `${BASE_URL}/users/notice/delete`,
    NOTICE_VIEW: `${BASE_URL}/users/notice/view`,
    NOTICE_EMPLOYEES: `${BASE_URL}/users/notice/employees`,
    GET_ALL_ATTENDANCE: `${BASE_URL}/users/getAllUsersDailyAttendance`,
    GET_ATTENDANCE_LIST: `${BASE_URL}/users/getDailyAttendanceList`,
    MARK_MANUAL_ATTENDANCE: `${BASE_URL}/users/markManualAttendance`,
}

const headerConfig = {
    headers: {
        'Authorization': `Bearer`,
        'Accept': 'application/json'
    }
}

const ROLES = {
    SUPER_ADMIN: 'superAdmin',
    HR: 'hr',
    ADMIN: 'admin',
    DEVELOPER: 'developer'
};

const ROLE_PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: {
        canAdd: [ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER],
        canEdit: [ROLES.SUPER_ADMIN, ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER],
        canDelete: [ROLES.SUPER_ADMIN, ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER]
    },
    [ROLES.HR]: {
        canAdd: [ROLES.HR, ROLES.DEVELOPER],
        canEdit: [ROLES.HR, ROLES.DEVELOPER],
        canDelete: [ROLES.HR, ROLES.DEVELOPER]
    },
    [ROLES.ADMIN]: {
        canAdd: [ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER],
        canEdit: [ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER],
        canDelete: [ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER]
    },
    [ROLES.DEVELOPER]: {
        canAdd: [],
        canEdit: [],
        canDelete: []
    }
};
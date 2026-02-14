const ROLES = {
    SUPER_ADMIN: 'superAdmin',
    HR: 'hr',
    ADMIN: 'admin',
    DEVELOPER: 'developer'
};

const ROLE_HIERARCHY = {
    [ROLES.SUPER_ADMIN]: 4,
    [ROLES.HR]: 3,
    [ROLES.ADMIN]: 2,
    [ROLES.DEVELOPER]: 1
};

// Permissions Matrix: Who can manage (Add/Edit/Delete) which roles
const PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: {
        canAdd: [ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER],
        canEdit: [ROLES.SUPER_ADMIN, ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER],
        canDelete: [ROLES.SUPER_ADMIN, ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER]
    },
    [ROLES.HR]: {
        canAdd: [ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER],
        canEdit: [ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER],
        canDelete: [ROLES.HR, ROLES.ADMIN, ROLES.DEVELOPER]
    },
    [ROLES.ADMIN]: {
        canAdd: [ROLES.ADMIN, ROLES.DEVELOPER],
        canEdit: [ROLES.ADMIN, ROLES.DEVELOPER],
        canDelete: [ROLES.ADMIN, ROLES.DEVELOPER]
    },
    [ROLES.DEVELOPER]: {
        canAdd: [],
        canEdit: [],
        canDelete: []
    }
};

module.exports = {
    ROLES,
    ROLE_HIERARCHY,
    PERMISSIONS
};

const { PERMISSIONS } = require('../utils/constants');
const response = require('../utils/response');
const models = require('../models/zindex');
const mongoose = require('mongoose');

/**
 * Middleware to check RBAC permissions
 * @param {string} action - 'canAdd', 'canEdit', or 'canDelete'
 * @param {string} roleParamName - The field name in req.body that contains the target user's role
 */
const checkRBAC = (action, roleParamName = 'role') => {
    return async (req, res, next) => {
        const currentUserRole = req.userRole || 'developer';
        let finalAction = action;

        if (!finalAction || finalAction === 'auto') {
            finalAction = (req.body._id || req.body.id) ? 'canEdit' : 'canAdd';
        }

        console.log(`RBAC Check: userRole=${currentUserRole}, action=${finalAction}, targetId=${req.body._id || req.body.id}, newRole=${req.body[roleParamName]}`);

        const rolePermissions = PERMISSIONS[currentUserRole];
        if (!rolePermissions || !rolePermissions[finalAction]) {
            console.log(`RBAC Failed: No permissions found for ${currentUserRole} / ${finalAction}`);
            return response.forbidden("You don't have permission to perform this action.", res);
        }

        const targetId = req.body.id || req.body._id;
        const newRoleFromBody = req.body[roleParamName];

        // 1. If editing/deleting, verify permission to manage the target user's CURRENT role
        if (targetId) {
            try {
                const targetUser = await models.User.findById(targetId).select('role');
                if (!targetUser) {
                    return response.badRequest("Target user not found.", res);
                }

                const currentTargetRole = targetUser.role;
                if (!rolePermissions[finalAction].includes(currentTargetRole)) {
                    const displayAction = finalAction.replace('can', '').toLowerCase();
                    return response.forbidden(`As ${currentUserRole}, you cannot ${displayAction} a ${currentTargetRole}.`, res);
                }
            } catch (error) {
                console.error("RBAC Middleware Error:", error);
                return response.serverError(error, res);
            }
        }

        // 2. If role is being set (Add or Edit with role change), verify permission to assign the NEW role
        if (newRoleFromBody) {
            const allowedRoles = rolePermissions[finalAction] || [];
            console.log(`RBAC Check Role: newRole=${newRoleFromBody}, allowedRoles=${JSON.stringify(allowedRoles)}`);
            if (!allowedRoles.includes(newRoleFromBody)) {
                return response.forbidden(`As ${currentUserRole}, you cannot assign the ${newRoleFromBody} role.`, res);
            }
        } else if (finalAction === 'canAdd') {
            return response.badRequest("User role is required.", res);
        }

        next();
    };
};

module.exports = {
    checkRBAC
};

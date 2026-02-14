const joi = require('joi');

exports.signIn = joi.object().keys({
    email: joi.string().email().required(),
    password: joi.string().required()
});

exports.createUser = joi.object().keys({
    name: joi.string().required(),
    mobile: joi.string().required(),
    email: joi.string().required(),
    jobTitle: joi.string().required(),
    password: joi.string().allow('').when('_id', {
        is: joi.string().valid('', null).optional(),
        then: joi.required(),
        otherwise: joi.optional()
    }),
    role: joi.string().valid('superAdmin', 'hr', 'admin', 'developer').required(),
    workType: joi.string().valid('onsite', 'remote').when('role', {
        is: 'developer',
        then: joi.string().required(),
        otherwise: joi.string().optional().allow('')
    }),
}).unknown(true);
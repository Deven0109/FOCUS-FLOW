const Joi = require('joi');

exports.saveTicket = Joi.object({
    ticketNumber: Joi.string().required().trim(),
    projectId: Joi.string().required(),
    description: Joi.string().required().trim(),
    status: Joi.string().valid('Open', 'In Progress', 'Resolved', 'Closed').default('Open'),
    assignedTo: Joi.string().required(),
    createdBy: Joi.string().required(),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').default('Medium'),
    comments: Joi.array().items().optional()
}).unknown(true);

exports.updateTicket = Joi.object({
    projectId: Joi.string().required(),
    description: Joi.string().required().trim(),
    status: Joi.string().valid('Open', 'In Progress', 'Resolved', 'Closed').default('Open'),
    assignedTo: Joi.string().required(),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').default('Medium'),
    comments: Joi.array().items().optional()
}).unknown(true);
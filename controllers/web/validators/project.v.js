let joi = require('joi');

exports.saveProject = joi.object().keys({
    name: joi.string().required(),
    description: joi.string().required()
}).unknown(true);
const jwt = require('jsonwebtoken');
const models = require('./../models/zindex');
const response = require('./../utils/response')

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    const user = await models.User.findOne({ _id: decodedData.id, isActive: true });
    if (!user) { return response.unauthorized(res); }
    req.userId = decodedData.id;
    req.userRole = decodedData.role;
    req.userWorkType = user.workType; // Add workType for notice filtering
    next();
  } catch (error) {
    return response.unauthorized(res);
  }
};

const adminCheck = (req, res, next) => {
  const adminRoles = ['superAdmin', 'hr', 'admin'];
  if (!adminRoles.includes(req.userRole)) {
    return response.forbidden('Access denied. Administrative role required.', res);
  }
  next();
};

const hrOnlyCheck = (req, res, next) => {
  if (req.userRole !== 'hr') {
    return response.forbidden('Access denied. HR role required.', res);
  }
  next();
};

const hrOrDeveloperCheck = (req, res, next) => {
  const allowedRoles = ['hr', 'developer'];
  if (!allowedRoles.includes(req.userRole)) {
    return response.forbidden('Access denied. This module is only for HR and Developers.', res);
  }
  next();
};

module.exports = { authMiddleware, adminCheck, hrOnlyCheck, hrOrDeveloperCheck };

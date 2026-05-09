const { ForbiddenError } = require('../utils/errors');

/**
 * Role-based authorization middleware factory.
 * @param {...string} roles - Allowed roles
 */
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  };
}

module.exports = authorize;

const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

/**
 * Middleware that checks express-validator results and throws ValidationError if any.
 */
function validate(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    throw new ValidationError('Validation failed', details);
  }
  next();
}

module.exports = validate;

const logger = require('../utils/logger');

/**
 * Global error handler middleware.
 */
function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    logger.error({ err }, 'Unhandled error');
  }

  const response = {
    error: {
      code,
      message: err.isOperational ? err.message : 'Internal server error',
    },
  };

  if (err.details) {
    response.error.details = err.details;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;

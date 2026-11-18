const AppError = require('../utils/AppError');

// Runs when no route matched the request.
function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

module.exports = notFound;

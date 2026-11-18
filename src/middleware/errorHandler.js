const config = require('../config');

// Standard error response:
//   { "success": false, "error": { "code": "...", "message": "...", "details": ... } }
//
// Express knows this is the error handler because it takes 4 arguments,
// so keep `next` even though it is not used.
function errorHandler(err, req, res, next) {
  // Invalid JSON in the request body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    });
  }

  // Expected errors we threw on purpose (AppError)
  if (err.statusCode && err.code) {
    const error = { code: err.code, message: err.message };
    if (err.details !== undefined) error.details = err.details;
    return res.status(err.statusCode).json({ success: false, error });
  }

  // Unexpected errors (bugs): log them, and hide the details in production
  console.error(err);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isProduction ? 'Something went wrong' : err.message,
    },
  });
}

module.exports = errorHandler;

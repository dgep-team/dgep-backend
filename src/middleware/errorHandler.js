const config = require('../config');

// Turns database errors into clear API errors. Returns null if it's not one.
function fromDatabaseError(err) {
  // Prisma error codes: https://www.prisma.io/docs/orm/reference/error-reference
  if (err.code === 'P2002') {
    return { status: 409, code: 'ALREADY_EXISTS', message: 'A record with this value already exists' };
  }
  if (err.code === 'P2025') {
    return { status: 404, code: 'NOT_FOUND', message: 'Record not found' };
  }
  // Our own database rules (see prisma/migrations/*_init/migration.sql)
  const text = String(err.message || '');
  if (text.includes('bookings_no_overlap')) {
    return { status: 409, code: 'ROOM_NOT_AVAILABLE', message: 'Room is already booked for these dates' };
  }
  if (text.includes('bookings_dates_check')) {
    return { status: 400, code: 'INVALID_DATES', message: 'Check-out must be after check-in' };
  }
  return null;
}

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

  const dbError = fromDatabaseError(err);
  if (dbError) {
    return res.status(dbError.status).json({
      success: false,
      error: { code: dbError.code, message: dbError.message },
    });
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

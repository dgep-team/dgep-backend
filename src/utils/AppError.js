// Throw this for expected errors (bad input, not found, not allowed).
// The error handler turns it into the standard JSON error response.
//
//   throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;

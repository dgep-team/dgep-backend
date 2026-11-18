// Express 4 does not catch errors thrown inside async functions.
// Wrap async controllers with this so errors reach the error handler.
//
//   router.get('/', asyncHandler(controller.list));
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;

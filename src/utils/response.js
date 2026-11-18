// Standard success response:
//   { "success": true, "data": ... }
//
//   sendSuccess(res, booking);        // 200
//   sendSuccess(res, booking, 201);   // 201 Created
function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

module.exports = { sendSuccess };

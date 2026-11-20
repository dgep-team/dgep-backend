const express = require('express');

// All feature routes are mounted here, under /api/v1.
// To add a feature: create routes/<feature>.routes.js and add one line below.
//
//   router.use('/bookings', require('./booking.routes'));
const router = express.Router();

router.use('/', require('./auth.routes')); // logins: must come before /admin and /platform
router.use('/platform', require('./platform.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/bookings', require('./booking.routes'));
router.use('/bookings', require('./checkIn.routes'));
router.use('/', require('./request.routes'));
router.use('/', require('./catalog.routes'));

module.exports = router;

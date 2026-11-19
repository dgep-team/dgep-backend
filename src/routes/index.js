const express = require('express');

// All feature routes are mounted here, under /api/v1.
// To add a feature: create routes/<feature>.routes.js and add one line below.
//
//   router.use('/bookings', require('./booking.routes'));
const router = express.Router();

router.use('/bookings', require('./checkIn.routes'));
router.use('/bookings', require('./idVerification.routes'));
router.use('/bookings', require('./digitalKey.routes'));
router.use('/admin/id-verifications', require('./adminIdVerification.routes'));

module.exports = router;

const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/checkIn.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const checkInBody = z.object({
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM, e.g. 14:30'),
  specialRequests: z.string().trim().max(500).optional(),
});

// Mounted at /api/v1/bookings
router.get('/:id/check-in', requireAuth, asyncHandler(controller.getCheckIn));
router.post('/:id/check-in', requireAuth, validate(checkInBody), asyncHandler(controller.completeCheckIn));

module.exports = router;

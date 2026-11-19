const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/admin.controller');
const { requireStaff } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Not a real date');

const overviewQuery = z.object({ date: date.optional() });
const bookingsQuery = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']).optional(),
  from: date.optional(),
  to: date.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
const guestsQuery = z.object({ search: z.string().trim().min(1).max(100).optional() });
const availabilityQuery = z
  .object({ from: date, to: date })
  .refine((q) => q.to > q.from, { path: ['to'], message: 'Must be after from' });

// Mounted at /api/v1/admin (staff only)
router.use(requireStaff);
router.get('/overview', validate(overviewQuery, 'query'), asyncHandler(controller.overview));
router.get('/bookings', validate(bookingsQuery, 'query'), asyncHandler(controller.listBookings));
router.get('/bookings/:id', asyncHandler(controller.getBooking));
router.post('/bookings/:id/check-in', asyncHandler(controller.checkInAtDesk));
router.get('/guests', validate(guestsQuery, 'query'), asyncHandler(controller.listGuests));
router.get('/rooms/availability', validate(availabilityQuery, 'query'), asyncHandler(controller.roomAvailability));

module.exports = router;

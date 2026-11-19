const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/admin.controller');
const { requireStaff, requireStaffRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { staffBody } = require('./schemas');

const router = express.Router();
const managerOnly = requireStaffRole('MANAGER');

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Not a real date');
const search = z.string().trim().min(1).max(100);

const overviewQuery = z.object({ date: date.optional() });
const bookingsQuery = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']).optional(),
  from: date.optional(),
  to: date.optional(),
  search: search.optional(),
});
const guestsQuery = z.object({ search: search.optional() });
const availabilityQuery = z
  .object({ from: date, to: date })
  .refine((q) => q.to > q.from, { path: ['to'], message: 'Must be after from' });
const roomBody = z.object({
  number: z.string().trim().min(1).max(10),
  type: z.string().trim().min(2).max(50),
  pricePerNight: z.number().int().positive(), // kobo
});

// Mounted at /api/v1/admin (hotel staff; always their own hotel)
router.use(requireStaff);

// Dashboard
router.get('/overview', validate(overviewQuery, 'query'), asyncHandler(controller.overview));
router.get('/bookings', validate(bookingsQuery, 'query'), asyncHandler(controller.listBookings));
router.get('/bookings/:id', asyncHandler(controller.getBooking));
router.post('/bookings/:id/check-in', asyncHandler(controller.checkInAtDesk));
router.get('/guests', validate(guestsQuery, 'query'), asyncHandler(controller.listGuests));
router.get('/rooms/availability', validate(availabilityQuery, 'query'), asyncHandler(controller.roomAvailability));
router.use('/requests', require('./adminRequest.routes'));

// Rooms and staff
router.post('/rooms', managerOnly, validate(roomBody), asyncHandler(controller.addRoom));
router.get('/staff', asyncHandler(controller.listStaff));
router.post('/staff', managerOnly, validate(staffBody), asyncHandler(controller.addStaff));

module.exports = router;

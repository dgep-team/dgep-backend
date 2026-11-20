const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/booking.controller');
const { requireGuest, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { date, email, name, phone } = require('./schemas');

const router = express.Router();

const createBody = z
  .object({
    roomTypeId: z.string().min(1),
    checkIn: date,
    checkOut: date,
    guests: z.number().int().min(1).max(10).optional(),
    guest: z.object({ email, firstName: name, lastName: name, phone: phone.optional() }).optional(), // booking without an account
  })
  .refine((b) => b.checkOut > b.checkIn, { path: ['checkOut'], message: 'Must be after checkIn' });

// Mounted at /api/v1/bookings. Booking works with or without a login.
router.post('/', optionalAuth, validate(createBody), asyncHandler(controller.create));
router.get('/', requireGuest, asyncHandler(controller.listMine));
router.get('/:id', requireGuest, asyncHandler(controller.getOne));
router.patch('/:id/cancel', requireGuest, asyncHandler(controller.cancel));

module.exports = router;

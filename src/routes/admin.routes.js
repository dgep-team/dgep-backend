const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/admin.controller');
const { requireStaff, requireStaffRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { staffBody, date } = require('./schemas');
const { ADD_ON_PER } = require('../utils/pricing');

const router = express.Router();
const managerOnly = requireStaffRole('MANAGER');

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
const text = (max) => z.string().trim().min(1).max(max);
const list = (max) => z.array(text(80)).max(max);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');

const profileBody = z
  .object({
    description: text(2000),
    phone: z.string().trim().regex(/^\+?\d{7,15}$/, 'Digits only, e.g. +2348012345678'),
    photos: z.array(z.string().url()).max(10),
    amenities: list(30),
    checkInTime: time,
    checkOutTime: time,
    arrivalInstructions: text(2000),
    parkingInfo: text(500),
    taxes: z.array(z.object({ name: text(40), percent: z.number().min(0).max(100) })).max(5),
    addOns: z
      .array(z.object({
        code: z.string().regex(/^[A-Z][A-Z0-9_]{1,29}$/, 'Capitals and _, e.g. AIRPORT_PICKUP'),
        name: text(60),
        price: z.number().int().positive(), // kobo
        per: z.enum(ADD_ON_PER),
      }))
      .max(20)
      .refine((list) => new Set(list.map((a) => a.code)).size === list.length, 'Each code once'),
  })
  .partial();
const roomTypeBody = z.object({
  name: text(60),
  description: text(2000).optional(),
  bedType: text(60),
  maxGuests: z.number().int().min(1).max(10),
  sizeSqm: z.number().int().positive().optional(),
  view: text(60).optional(),
  amenities: list(30).optional(),
  accessibility: list(20).optional(),
  photos: z.array(z.string().url()).max(10).optional(),
  pricePerNight: z.number().int().positive(), // kobo
  cancellationPolicy: text(1000).optional(),
});
const roomBody = z.object({ number: text(10), roomTypeId: z.string().min(1) });

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

// Hotel listing, room types and rooms (managers change them; all staff can read)
router.get('/hotel', asyncHandler(controller.getProfile));
router.patch('/hotel', managerOnly, validate(profileBody), asyncHandler(controller.updateProfile));
router.get('/room-types', asyncHandler(controller.listRoomTypes));
router.post('/room-types', managerOnly, validate(roomTypeBody), asyncHandler(controller.addRoomType));
router.patch('/room-types/:id', managerOnly, validate(roomTypeBody.partial()), asyncHandler(controller.updateRoomType));
router.post('/rooms', managerOnly, validate(roomBody), asyncHandler(controller.addRoom));

// Staff
router.get('/staff', asyncHandler(controller.listStaff));
router.post('/staff', managerOnly, validate(staffBody), asyncHandler(controller.addStaff));

module.exports = router;

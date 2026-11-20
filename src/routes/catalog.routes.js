const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/catalog.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { stayDates } = require('./schemas');

const router = express.Router();

const hotelsQuery = z.object({ city: z.string().trim().min(2).max(60).optional() });
const hotelQuery = stayDates({ guests: z.coerce.number().int().min(1).max(10).optional() });
const compareQuery = stayDates({
  ids: z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .refine((ids) => ids.length >= 1 && ids.length <= 3, 'Send 1 to 3 room type ids, comma-separated'),
});

// Mounted at /api/v1 (full paths). Browsing needs no login.
router.get('/hotels', validate(hotelsQuery, 'query'), asyncHandler(controller.listHotels));
router.get('/hotels/:id', validate(hotelQuery, 'query'), asyncHandler(controller.getHotel));
router.get('/room-types/compare', validate(compareQuery, 'query'), asyncHandler(controller.compareRoomTypes));
router.get('/bookings/:id/arrival', requireAuth, asyncHandler(controller.arrivalInfo));

module.exports = router;

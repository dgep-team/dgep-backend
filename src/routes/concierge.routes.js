const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/concierge.controller');
const { SERVICE_CODES } = require('../services/concierge.service');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const createBody = z.object({
  serviceCode: z.enum(SERVICE_CODES),
  note: z.string().trim().max(500).optional(),
  scheduledFor: z
    .string()
    .datetime({ offset: true, message: 'Use ISO 8601, e.g. 2026-12-01T15:00:00+01:00' })
    .transform((s) => new Date(s))
    .refine((d) => d > new Date(), 'Must be in the future')
    .optional(),
});

// Mounted at /api/v1 (the paths below are full paths)
router.get('/concierge/services', requireAuth, controller.listServices);
router.post('/bookings/:id/requests', requireAuth, validate(createBody), asyncHandler(controller.createRequest));
router.get('/bookings/:id/requests', requireAuth, asyncHandler(controller.listForBooking));
router.get('/requests/:id', requireAuth, asyncHandler(controller.getRequest));
router.patch('/requests/:id/cancel', requireAuth, asyncHandler(controller.cancelRequest));

module.exports = router;

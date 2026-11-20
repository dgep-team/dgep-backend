const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/request.controller');
const { CATEGORY_CODES } = require('../services/request.service');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const createBody = z
  .object({
    category: z.enum(CATEGORY_CODES),
    note: z.string().trim().min(1).max(500).optional(),
    preferredTime: z
      .string()
      .datetime({ offset: true, message: 'Use ISO 8601, e.g. 2026-12-01T15:00:00+01:00' })
      .transform((s) => new Date(s))
      .refine((d) => d > new Date(), 'Must be in the future')
      .optional(),
  })
  .refine((b) => b.category !== 'OTHER' || b.note, { path: ['note'], message: 'Tell us what you need' });

// Mounted at /api/v1 (the paths below are full paths)
router.get('/concierge/categories', requireAuth, controller.listCategories);
router.post('/bookings/:id/requests', requireAuth, validate(createBody), asyncHandler(controller.createRequest));
router.get('/bookings/:id/requests', requireAuth, asyncHandler(controller.listForBooking));
router.get('/requests/:id', requireAuth, asyncHandler(controller.getRequest));
router.patch('/requests/:id/cancel', requireAuth, asyncHandler(controller.cancelRequest));

module.exports = router;

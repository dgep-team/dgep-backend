const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/platform.controller');
const { requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { staffBody } = require('./schemas');

const router = express.Router();

const TIMEZONES = Intl.supportedValuesOf('timeZone');

const hotelBody = z.object({
  name: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(60),
  address: z.string().trim().min(5).max(200),
  phone: z.string().trim().regex(/^\+?\d{7,15}$/, 'Digits only, e.g. +2348012345678').optional(),
  timezone: z.string().refine((tz) => TIMEZONES.includes(tz), 'Use a time zone name, e.g. Africa/Lagos').optional(),
  paystackSubaccount: z.string().regex(/^ACCT_\w+$/, 'A Paystack subaccount code, e.g. ACCT_abc123').optional(),
});
const statusBody = z.object({ status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']) });

// Mounted at /api/v1/platform (the platform team only)
router.use(requireAdmin);
router.post('/hotels', validate(hotelBody), asyncHandler(controller.createHotel));
router.get('/hotels', asyncHandler(controller.listHotels));
router.patch('/hotels/:id/status', validate(statusBody), asyncHandler(controller.setStatus));
router.post('/hotels/:id/staff', validate(staffBody), asyncHandler(controller.addStaff));

module.exports = router;

const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/admin.controller');
const { requireStaff, requireStaffRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { staffBody } = require('./schemas');

const router = express.Router();
const managerOnly = requireStaffRole('MANAGER');

const roomBody = z.object({
  number: z.string().trim().min(1).max(10),
  type: z.string().trim().min(2).max(50),
  pricePerNight: z.number().int().positive(), // kobo
});

// Mounted at /api/v1/admin (hotel staff; always their own hotel)
router.use(requireStaff);
router.post('/rooms', managerOnly, validate(roomBody), asyncHandler(controller.addRoom));
router.get('/staff', asyncHandler(controller.listStaff));
router.post('/staff', managerOnly, validate(staffBody), asyncHandler(controller.addStaff));
router.use('/requests', require('./adminRequest.routes'));

module.exports = router;

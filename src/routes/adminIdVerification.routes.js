const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/idVerification.controller');
const { requireStaff } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const listQuery = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'FAILED']).optional(),
});

const reviewBody = z
  .object({
    status: z.enum(['VERIFIED', 'FAILED']),
    reason: z.string().trim().min(1).max(300).optional(),
  })
  .refine((b) => b.status !== 'FAILED' || b.reason, { path: ['reason'], message: 'Say why the ID failed' });

// Mounted at /api/v1/admin/id-verifications (staff only)
router.use(requireStaff);
router.get('/', validate(listQuery, 'query'), asyncHandler(controller.list));
router.patch('/:id', validate(reviewBody), asyncHandler(controller.review));

module.exports = router;

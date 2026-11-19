const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/idVerification.controller');
const { requireAuth } = require('../middleware/auth');
const { uploadImages } = require('../middleware/upload');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const submitBody = z.object({
  idType: z.enum(['NIN', 'PASSPORT', 'DRIVERS_LICENSE', 'VOTERS_CARD']),
  idNumber: z.string().trim().min(4).max(30),
});

// Mounted at /api/v1/bookings. The upload runs first: it reads the form fields too.
router.post(
  '/:id/id-verification',
  requireAuth,
  uploadImages(['idImage', 'selfie']),
  validate(submitBody),
  asyncHandler(controller.submit),
);
router.get('/:id/id-verification', requireAuth, asyncHandler(controller.getStatus));

module.exports = router;

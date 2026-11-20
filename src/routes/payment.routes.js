const express = require('express');
const controller = require('../controllers/payment.controller');
const { requireGuest } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Mounted at /api/v1 (full paths)
router.post('/bookings/:id/payments', requireGuest, asyncHandler(controller.start));
router.get('/payments/verify/:reference', requireGuest, asyncHandler(controller.verify));
router.post('/payments/webhook', asyncHandler(controller.webhook)); // Paystack only: checked by signature

module.exports = router;

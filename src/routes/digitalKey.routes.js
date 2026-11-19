const express = require('express');
const controller = require('../controllers/digitalKey.controller');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Mounted at /api/v1/bookings
router.get('/:id/key', requireAuth, asyncHandler(controller.getKey));
router.post('/:id/key/unlock', requireAuth, asyncHandler(controller.unlock));

module.exports = router;

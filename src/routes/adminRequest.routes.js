const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/concierge.controller');
const { requireStaff } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
const listQuery = z.object({ status: z.enum(STATUSES).optional() });
const statusBody = z.object({ status: z.enum(STATUSES) });

// Mounted at /api/v1/admin/requests (staff only)
router.use(requireStaff);
router.get('/', validate(listQuery, 'query'), asyncHandler(controller.listAll));
router.get('/:id', asyncHandler(controller.getForStaff));
router.patch('/:id/status', validate(statusBody), asyncHandler(controller.updateStatus));

module.exports = router;

const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/request.controller');
const { requireStaffRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const listQuery = z.object({
  status: z.enum(['SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  assignedTo: z.string().min(1).optional(), // a staff id, or "me"
});
const statusBody = z.object({ status: z.enum(['IN_PROGRESS', 'COMPLETED']) });
const assignBody = z.object({ staffId: z.string().min(1).nullable() }); // null = unassign

// Mounted at /api/v1/admin/requests, inside admin.routes.js (staff are already checked there)
router.get('/', validate(listQuery, 'query'), asyncHandler(controller.listForHotel));
router.get('/:id', asyncHandler(controller.getForStaff));
router.patch('/:id/status', validate(statusBody), asyncHandler(controller.updateStatus));
router.patch('/:id/assign', requireStaffRole('MANAGER', 'RECEPTION'), validate(assignBody), asyncHandler(controller.assign));

module.exports = router;

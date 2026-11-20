const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/auth.controller');
const { requireGuest } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { email, password, name, phone, loginBody } = require('./schemas');

const router = express.Router();

const registerBody = z.object({ email, password, firstName: name, lastName: name, phone: phone.optional() });
const setPasswordBody = z.object({ password, currentPassword: z.string().max(72).optional() });
const meBody = z.object({ firstName: name, lastName: name, phone }).partial();

// Mounted at /api/v1 (full paths)
router.post('/auth/register', validate(registerBody), asyncHandler(controller.register));
router.post('/auth/login', validate(loginBody), asyncHandler(controller.login));
router.post('/auth/password', requireGuest, validate(setPasswordBody), asyncHandler(controller.setPassword));
router.get('/me', requireGuest, asyncHandler(controller.getMe));
router.patch('/me', requireGuest, validate(meBody), asyncHandler(controller.updateMe));
router.post('/admin/auth/login', validate(loginBody), asyncHandler(controller.staffLogin));
router.post('/platform/auth/login', validate(loginBody), asyncHandler(controller.adminLogin));

module.exports = router;

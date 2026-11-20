// Who is calling?
//
//   Authorization: Bearer <accessToken>   from POST /auth/login, /admin/auth/login or /platform/auth/login
//
// For local testing (AUTH_STUB, off on Render) these headers work too:
//   X-User-Id: <id>    X-User-Role: guest (default), staff or admin
//
// Staff are looked up so we know their hotel; everything they see is limited
// to that hotel. Controllers use req.user:
//   guest: { id, role: 'guest' }
//   staff: { id, role: 'staff', staffRole, hotelId, hotel }
//   admin: { id, role: 'admin' }
const config = require('../config');
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { readToken } = require('../utils/auth');

const ROLES = ['guest', 'staff', 'admin'];

function whoFromRequest(req) {
  const bearer = req.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (bearer) return readToken(bearer);
  if (!config.authStub) return null;
  const id = req.get('X-User-Id');
  const role = req.get('X-User-Role') || 'guest';
  return id && ROLES.includes(role) ? { id, role } : null;
}

async function readUser(req) {
  const who = whoFromRequest(req);
  if (!who || who.role !== 'staff') return who;
  const staff = await prisma.staff.findUnique({ where: { id: who.id }, include: { hotel: true } });
  return staff && { id: who.id, role: 'staff', staffRole: staff.role, hotelId: staff.hotelId, hotel: staff.hotel };
}

// requireRole() = any logged-in user; requireRole('staff') = staff only
const requireRole = (...roles) => async (req, res, next) => {
  try {
    req.user = await readUser(req);
  } catch (err) {
    return next(err);
  }
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Please log in'));
  if (roles.length && !roles.includes(req.user.role)) return next(new AppError(403, 'FORBIDDEN', 'You are not allowed to do this'));
  if (req.user.hotel?.status === 'SUSPENDED') return next(new AppError(403, 'HOTEL_SUSPENDED', 'This hotel is suspended'));
  next();
};

// Logged in or not: sets req.user when there is a valid login (e.g. booking without an account)
const optionalAuth = async (req, res, next) => {
  try {
    req.user = await readUser(req);
    next();
  } catch (err) {
    next(err);
  }
};

// Use after requireStaff: only these staff roles, e.g. requireStaffRole('MANAGER')
const requireStaffRole = (...staffRoles) => (req, res, next) => {
  if (!staffRoles.includes(req.user.staffRole)) return next(new AppError(403, 'FORBIDDEN', 'Your staff role cannot do this'));
  next();
};

module.exports = {
  requireAuth: requireRole(),
  requireGuest: requireRole('guest'),
  requireStaff: requireRole('staff'),
  requireAdmin: requireRole('admin'),
  requireStaffRole,
  optionalAuth,
};

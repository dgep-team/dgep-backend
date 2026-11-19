// TEMPORARY login until SCRUM-27 adds real tokens (JWT).
//
// For now the caller says who they are with two headers:
//   X-User-Id:   the guest's id, or the staff member's id
//   X-User-Role: guest (default), staff, or admin (the platform team)
//
// Staff are looked up in the database so we know their hotel. Everything a
// staff member sees is limited to that hotel.
//
// SCRUM-27 only needs to replace readUser(). Routes keep using the require*
// checks below, and controllers keep using req.user:
//   guest: { id, role: 'guest' }
//   staff: { id, role: 'staff', staffRole, hotelId, hotel }
//   admin: { id, role: 'admin' }
const config = require('../config');
const prisma = require('../config/db');
const AppError = require('../utils/AppError');

const ROLES = ['guest', 'staff', 'admin'];

async function readUser(req) {
  if (!config.authStub) return null;
  const id = req.get('X-User-Id');
  const role = req.get('X-User-Role') || 'guest';
  if (!id || !ROLES.includes(role)) return null;
  if (role !== 'staff') return { id, role };

  const staff = await prisma.staff.findUnique({ where: { id }, include: { hotel: true } });
  return staff && { id, role, staffRole: staff.role, hotelId: staff.hotelId, hotel: staff.hotel };
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

// Use after requireStaff: only these staff roles, e.g. requireStaffRole('MANAGER')
const requireStaffRole = (...staffRoles) => (req, res, next) => {
  if (!staffRoles.includes(req.user.staffRole)) return next(new AppError(403, 'FORBIDDEN', 'Your staff role cannot do this'));
  next();
};

module.exports = {
  requireAuth: requireRole(),
  requireStaff: requireRole('staff'),
  requireAdmin: requireRole('admin'),
  requireStaffRole,
};

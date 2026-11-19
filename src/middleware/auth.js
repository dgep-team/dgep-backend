// TEMPORARY login until SCRUM-27 adds real tokens (JWT).
//
// For now the caller says who they are with two headers:
//   X-User-Id:   the guest's (or staff member's) id
//   X-User-Role: guest (default) or staff
//
// SCRUM-27 only needs to replace readUser(). Routes keep using
// requireAuth / requireStaff, and controllers keep using req.user = { id, role }.
const config = require('../config');
const AppError = require('../utils/AppError');

const ROLES = ['guest', 'staff'];

function readUser(req) {
  if (!config.authStub) return null;
  const id = req.get('X-User-Id');
  const role = req.get('X-User-Role') || 'guest';
  return id && ROLES.includes(role) ? { id, role } : null;
}

function requireAuth(req, res, next) {
  req.user = readUser(req);
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Please log in'));
  next();
}

function requireStaff(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== 'staff') return next(new AppError(403, 'FORBIDDEN', 'Staff only'));
    next();
  });
}

module.exports = { requireAuth, requireStaff };

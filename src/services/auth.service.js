// Login for guests, hotel staff and the platform team.
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { hashPassword, checkPassword, signToken } = require('../utils/auth');

const WITH_HASH = { omit: { passwordHash: false } };
const wrongLogin = () => new AppError(401, 'INVALID_LOGIN', 'Email or password is wrong');
const withoutHash = ({ passwordHash, ...rest }) => rest; // eslint-disable-line no-unused-vars

// ----- Guests -----

async function register({ password, ...data }) {
  const existing = await prisma.guest.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new AppError(409, 'ALREADY_EXISTS', 'This email already has an account or a booking. Please log in.');
  }
  const guest = await prisma.guest.create({ data: { ...data, passwordHash: await hashPassword(password) } });
  return { guest, accessToken: signToken({ id: guest.id, role: 'guest' }) };
}

async function login({ email, password }) {
  const guest = await prisma.guest.findUnique({ where: { email }, ...WITH_HASH });
  if (!(await checkPassword(password, guest?.passwordHash))) throw wrongLogin();
  return { guest: withoutHash(guest), accessToken: signToken({ id: guest.id, role: 'guest' }) };
}

// Guests who booked without an account can add a password while logged in
// with the token they got when booking. Changing one needs the current password.
async function setPassword(user, { password, currentPassword }) {
  const guest = await prisma.guest.findUnique({ where: { id: user.id }, ...WITH_HASH });
  if (!guest) throw new AppError(404, 'NOT_FOUND', 'Guest not found');
  if (guest.passwordHash && !(await checkPassword(currentPassword ?? '', guest.passwordHash))) {
    throw new AppError(401, 'INVALID_LOGIN', 'Your current password is wrong');
  }
  await prisma.guest.update({ where: { id: guest.id }, data: { passwordHash: await hashPassword(password) } });
  return { passwordSet: true };
}

async function getMe(user) {
  const guest = await prisma.guest.findUnique({ where: { id: user.id }, include: { _count: { select: { bookings: true } } } });
  if (!guest) throw new AppError(404, 'NOT_FOUND', 'Guest not found');
  return guest;
}

const updateMe = (user, data) => prisma.guest.update({ where: { id: user.id }, data });

// ----- Staff and platform team -----

async function staffLogin({ email, password }) {
  const staff = await prisma.staff.findUnique({ where: { email }, include: { hotel: { select: { id: true, name: true, status: true } } }, ...WITH_HASH });
  if (!(await checkPassword(password, staff?.passwordHash))) throw wrongLogin();
  if (staff.hotel.status === 'SUSPENDED') throw new AppError(403, 'HOTEL_SUSPENDED', 'This hotel is suspended');
  return { staff: withoutHash(staff), accessToken: signToken({ id: staff.id, role: 'staff', hotelId: staff.hotelId }) };
}

async function adminLogin({ email, password }) {
  const admin = await prisma.platformAdmin.findUnique({ where: { email }, ...WITH_HASH });
  if (!(await checkPassword(password, admin?.passwordHash))) throw wrongLogin();
  return { admin: withoutHash(admin), accessToken: signToken({ id: admin.id, role: 'admin' }) };
}

module.exports = { register, login, setPassword, getMe, updateMe, staffLogin, adminLogin };

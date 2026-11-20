const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { quote, nightsBetween } = require('../utils/pricing');
const { hotelToday } = require('../utils/dates');
const { signToken } = require('../utils/auth');

const HOLD_MINUTES = 30; // an unpaid booking keeps its room this long
const HOLDS_ROOM = ['PENDING', 'CONFIRMED', 'CHECKED_IN']; // the same statuses the no-overlap rule blocks
const BOOKING_VIEW = {
  payments: { select: { reference: true, status: true, amount: true, paidAt: true }, orderBy: { createdAt: 'desc' } },
  room: { include: { roomType: { select: { id: true, name: true, photos: true } }, hotel: { select: { id: true, name: true, city: true, address: true, phone: true } } } },
};

// Guest fields that are safe to show staff (never a password)
const GUEST_FIELDS = { id: true, firstName: true, lastName: true, email: true, phone: true };

// Loads a booking the user is allowed to see:
//   guest -> only their own booking
//   staff -> only bookings at their hotel (other hotels look like "not found")
//   const booking = await findBookingForUser(req.params.id, req.user);
async function findBookingForUser(bookingId, user, include = {}) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { room: true, ...include } });
  checkBookingAccess(booking, user, 'Booking');
  return booking;
}

// The same rule for anything that belongs to a booking (it needs booking.room)
function checkBookingAccess(booking, user, what) {
  const visible = booking && (user.role === 'staff' ? booking.room.hotelId === user.hotelId : user.role === 'guest');
  if (!visible) throw new AppError(404, 'NOT_FOUND', `${what} not found`);
  if (user.role === 'guest' && booking.guestId !== user.id) {
    throw new AppError(403, 'FORBIDDEN', `This is not your ${what.toLowerCase()}`);
  }
}

// ----- Guest bookings (PRD BR-08, BR-09) -----

// Unpaid bookings older than HOLD_MINUTES give their room back
function releaseExpiredHolds() {
  return prisma.booking.updateMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - HOLD_MINUTES * 60000) } },
    data: { status: 'CANCELLED' },
  });
}

const holdExpiresAt = (booking) =>
  booking.status === 'PENDING' ? new Date(booking.createdAt.getTime() + HOLD_MINUTES * 60000) : null;

// Logged-in guest, or a new guest booking without an account
async function guestForBooking(user, details) {
  if (user?.role === 'guest') return { guestId: user.id };
  if (user) throw new AppError(403, 'FORBIDDEN', 'Only guests can book');
  if (!details) throw new AppError(401, 'UNAUTHORIZED', 'Log in, or send your guest details to book without an account');

  const existing = await prisma.guest.findUnique({ where: { email: details.email } });
  if (existing) throw new AppError(409, 'LOGIN_REQUIRED', 'This email already has an account or a booking. Please log in.');
  const guest = await prisma.guest.create({ data: details });
  return { guestId: guest.id, accessToken: signToken({ id: guest.id, role: 'guest' }) };
}

async function createBooking(user, { roomTypeId, checkIn, checkOut, guests = 1, guest, addOns = [] }) {
  const type = await prisma.roomType.findUnique({ where: { id: roomTypeId }, include: { hotel: true, rooms: { select: { id: true } } } });
  if (!type || type.hotel.status !== 'ACTIVE') throw new AppError(404, 'NOT_FOUND', 'Room type not found');
  if (guests > type.maxGuests) throw new AppError(400, 'TOO_MANY_GUESTS', `This room is for up to ${type.maxGuests} guests`);
  if (checkIn < hotelToday(type.hotel.timezone)) throw new AppError(400, 'INVALID_DATES', "Check-in can't be in the past");
  const chosen = addOns.map((code) => type.hotel.addOns.find((a) => a.code === code));
  if (chosen.includes(undefined)) throw new AppError(400, 'UNKNOWN_ADD_ON', 'This hotel does not offer one of these add-ons');

  // Rooms of this type with no booking in the way
  await releaseExpiredHolds();
  const roomIds = type.rooms.map((r) => r.id);
  const taken = await prisma.booking.findMany({
    where: { roomId: { in: roomIds }, status: { in: HOLDS_ROOM }, checkIn: { lt: new Date(checkOut) }, checkOut: { gt: new Date(checkIn) } },
    select: { roomId: true },
  });
  const free = roomIds.filter((id) => !taken.some((b) => b.roomId === id));
  if (!free.length) throw new AppError(409, 'ROOM_NOT_AVAILABLE', 'No rooms of this type are free for these dates');

  const { guestId, accessToken } = await guestForBooking(user, guest);
  const price = quote({ pricePerNight: type.pricePerNight, nights: nightsBetween(checkIn, checkOut), taxes: type.hotel.taxes, addOns: chosen, guests });

  // Someone may take a room at the same moment: the database rule refuses, so try the next one
  for (const roomId of free) {
    try {
      const booking = await prisma.booking.create({
        data: { guestId, roomId, checkIn: new Date(checkIn), checkOut: new Date(checkOut), guests, addOns: price.addOns, totalAmount: price.total },
        include: BOOKING_VIEW,
      });
      return { booking: { ...booking, holdExpiresAt: holdExpiresAt(booking) }, price, ...(accessToken && { accessToken }) };
    } catch (err) {
      if (!String(err.message).includes('bookings_no_overlap')) throw err;
    }
  }
  throw new AppError(409, 'ROOM_NOT_AVAILABLE', 'No rooms of this type are free for these dates');
}

async function listMyBookings(user) {
  await releaseExpiredHolds();
  const bookings = await prisma.booking.findMany({ where: { guestId: user.id }, include: BOOKING_VIEW, orderBy: { createdAt: 'desc' } });
  return bookings.map((b) => ({ ...b, holdExpiresAt: holdExpiresAt(b) }));
}

async function getMyBooking(bookingId, user) {
  await releaseExpiredHolds();
  const booking = await findBookingForUser(bookingId, user, BOOKING_VIEW);
  return { ...booking, holdExpiresAt: holdExpiresAt(booking) };
}

// Free cancellation until the check-in day (refund rules: open question in the PRD)
async function cancelBooking(bookingId, user) {
  const booking = await findBookingForUser(bookingId, user, { room: { include: { hotel: true } } });
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw new AppError(409, 'BOOKING_CLOSED', 'This booking is cancelled or already checked in');
  }
  if (booking.checkIn.toISOString().slice(0, 10) <= hotelToday(booking.room.hotel.timezone)) {
    throw new AppError(409, 'TOO_LATE_TO_CANCEL', 'Please contact the hotel to cancel on or after the check-in day');
  }
  return prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' }, include: BOOKING_VIEW });
}

module.exports = {
  findBookingForUser, checkBookingAccess, GUEST_FIELDS, HOLD_MINUTES,
  releaseExpiredHolds, createBooking, listMyBookings, getMyBooking, cancelBooking,
};

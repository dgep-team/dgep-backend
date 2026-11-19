const prisma = require('../config/db');
const AppError = require('../utils/AppError');

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

module.exports = { findBookingForUser, checkBookingAccess, GUEST_FIELDS };

const prisma = require('../config/db');
const AppError = require('../utils/AppError');

// Loads a booking the user is allowed to see: their own, or any booking for staff.
//   const booking = await findBookingForUser(req.params.id, req.user);
async function findBookingForUser(bookingId, user, include = {}) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  if (user.role !== 'staff' && booking.guestId !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'This is not your booking');
  }
  return booking;
}

module.exports = { findBookingForUser };

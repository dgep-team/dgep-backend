// Online pre-check-in before arrival (PRD PC-01, PC-02):
//   1. pay       -> booking.status becomes CONFIRMED (SCRUM-27)
//   2. check in  -> arrival time, special requests and guest details are saved
// An ID is NOT needed (PRD: ID upload is optional, release 2).
// Guests who skip this can still check in at the front desk (PC-07).
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { findBookingForUser } = require('./booking.service');

const PAID_STATUSES = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'];

function summary(booking) {
  const done = Boolean(booking.onlineCheckInAt);
  return {
    paymentStatus: PAID_STATUSES.includes(booking.status) ? 'PAID' : 'UNPAID',
    idVerificationStatus: booking.idVerification?.status ?? 'NOT_SUBMITTED', // optional
    checkInStatus: done ? 'COMPLETED' : 'NOT_STARTED',
    canCheckIn: booking.status === 'CONFIRMED' && !done,
  };
}

async function getStatus(bookingId, user) {
  const booking = await findBookingForUser(bookingId, user, { idVerification: true });
  return summary(booking);
}

async function completeCheckIn(bookingId, user, { arrivalTime, specialRequests, guest }) {
  const booking = await findBookingForUser(bookingId, user, { idVerification: true });
  const status = summary(booking);

  if (status.checkInStatus === 'COMPLETED') return status; // already done: nothing to change
  if (booking.status === 'PENDING') throw new AppError(409, 'BOOKING_NOT_PAID', 'Please pay for the booking first');
  if (booking.status !== 'CONFIRMED') throw new AppError(409, 'BOOKING_CLOSED', 'This booking is cancelled or already checked out');

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      arrivalTime,
      specialRequests,
      onlineCheckInAt: new Date(),
      ...(guest && { guest: { update: guest } }), // fix name or phone (optional)
    },
    include: { idVerification: true },
  });
  return summary(updated);
}

module.exports = { getStatus, completeCheckIn, summary };

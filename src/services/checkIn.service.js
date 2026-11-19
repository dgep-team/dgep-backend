// Online check-in before arrival. The steps, in order:
//   1. pay       -> booking.status becomes CONFIRMED (SCRUM-27)
//   2. verify ID -> idVerification.status becomes VERIFIED (staff review)
//   3. check in  -> onlineCheckInAt is set and a digital key is made
const { randomBytes } = require('crypto');
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { findBookingForUser } = require('./booking.service');

const PAID_STATUSES = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'];

function summary(booking) {
  const paid = PAID_STATUSES.includes(booking.status);
  const idStatus = booking.idVerification?.status ?? 'NOT_SUBMITTED';
  const done = Boolean(booking.onlineCheckInAt);
  return {
    paymentStatus: paid ? 'PAID' : 'UNPAID',
    idVerificationStatus: idStatus,
    checkInStatus: done ? 'COMPLETED' : 'NOT_STARTED',
    canCheckIn: booking.status === 'CONFIRMED' && idStatus === 'VERIFIED' && !done,
  };
}

async function getStatus(bookingId, user) {
  const booking = await findBookingForUser(bookingId, user, { idVerification: true });
  return summary(booking);
}

async function completeCheckIn(bookingId, user, { arrivalTime, specialRequests }) {
  const booking = await findBookingForUser(bookingId, user, { idVerification: true });
  const status = summary(booking);

  if (status.checkInStatus === 'COMPLETED') return status; // already done: nothing to change
  if (booking.status === 'PENDING') throw new AppError(409, 'BOOKING_NOT_PAID', 'Please pay for the booking first');
  if (booking.status !== 'CONFIRMED') throw new AppError(409, 'BOOKING_CLOSED', 'This booking is cancelled or already checked out');
  if (status.idVerificationStatus !== 'VERIFIED') throw new AppError(409, 'ID_NOT_VERIFIED', 'Your ID has not been verified yet');

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      arrivalTime,
      specialRequests,
      onlineCheckInAt: new Date(),
      keyCode: randomBytes(24).toString('base64url'), // random and unguessable
    },
    include: { idVerification: true },
  });
  return summary(updated);
}

module.exports = { getStatus, completeCheckIn, summary };

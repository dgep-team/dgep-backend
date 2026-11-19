// The digital room key is a QR code the guest shows at the door.
// It works only after online check-in, and only during the stay:
// from 00:00 on the check-in day until 12:00 noon on the check-out day, hotel time.
const AppError = require('../utils/AppError');
const { findBookingForUser } = require('./booking.service');

const HOUR = 60 * 60 * 1000;
const HOTEL_UTC_OFFSET = 1; // Lagos is UTC+1 all year
const CHECK_OUT_HOUR = 12;
const ACTIVE_STATUSES = ['CONFIRMED', 'CHECKED_IN'];

const notActive = (message) => new AppError(403, 'KEY_NOT_ACTIVE', message);

// Stay dates are saved as midnight UTC, so shift them to hotel time
function keyWindow(booking) {
  return {
    validFrom: new Date(booking.checkIn.getTime() - HOTEL_UTC_OFFSET * HOUR),
    validUntil: new Date(booking.checkOut.getTime() + (CHECK_OUT_HOUR - HOTEL_UTC_OFFSET) * HOUR),
  };
}

// Throws KEY_NOT_ACTIVE unless the key works right now
function checkKeyActive(booking, now = new Date()) {
  if (!booking.onlineCheckInAt) throw notActive('Finish online check-in to get your key');
  if (!ACTIVE_STATUSES.includes(booking.status)) throw notActive('This booking no longer has a key');
  const window = keyWindow(booking);
  if (now < window.validFrom || now > window.validUntil) throw notActive('Your key works only during your stay');
  return window;
}

async function getKey(bookingId, user) {
  const booking = await findBookingForUser(bookingId, user, { room: true });
  const window = checkKeyActive(booking);
  return { keyId: booking.id, roomNumber: booking.room.number, qrCode: booking.keyCode, ...window };
}

// No real door lock yet: this checks the key and answers like a lock would
async function unlock(bookingId, user) {
  const booking = await findBookingForUser(bookingId, user);
  checkKeyActive(booking);
  return { result: 'UNLOCKED', at: new Date() };
}

module.exports = { getKey, unlock, checkKeyActive };

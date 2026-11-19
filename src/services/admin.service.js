// Staff dashboard: overview numbers, bookings, guests, desk check-in and room availability.
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { hotelToday } = require('../utils/dates');
const { findBookingForUser, GUEST_FIELDS } = require('./booking.service');
const { summary } = require('./checkIn.service');

const STAYING = ['CONFIRMED', 'CHECKED_IN']; // bookings that hold a room
const NO_KEY = { keyCode: true }; // staff never see the guest's room key

// Bookings whose stay overlaps from..to (check-out day doesn't count, as in the database rule)
const overlaps = (from, to) => ({ checkIn: { lte: to }, checkOut: { gt: from } });

async function overview({ date = hotelToday() }) {
  const day = new Date(date);
  const [arrivals, departures, occupied, rooms, openRequests] = await Promise.all([
    prisma.booking.count({ where: { checkIn: day, status: { in: STAYING } } }),
    prisma.booking.count({ where: { checkOut: day, status: { in: [...STAYING, 'CHECKED_OUT'] } } }),
    prisma.booking.count({ where: { checkIn: { lte: day }, checkOut: { gt: day }, status: { in: STAYING } } }),
    prisma.room.count(),
    prisma.serviceRequest.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
  ]);
  return {
    date,
    arrivalsToday: arrivals,
    departuresToday: departures,
    occupancyRate: rooms ? Math.round((occupied / rooms) * 100) / 100 : 0, // 0.75 = 75% of rooms
    openRequests,
    revenueToday: null, // needs the payments table from SCRUM-27
  };
}

async function listBookings({ status, from, to, search }) {
  const where = {};
  if (status) where.status = status;
  if (from || to) Object.assign(where, overlaps(new Date(from ?? '1970-01-01'), new Date(to ?? '9999-12-31')));
  if (search) {
    const has = { contains: search, mode: 'insensitive' };
    where.OR = [
      { guest: { OR: [{ firstName: has }, { lastName: has }, { email: has }] } },
      { room: { number: has } },
    ];
  }
  return prisma.booking.findMany({
    where,
    omit: NO_KEY,
    include: { guest: { select: GUEST_FIELDS }, room: true },
    orderBy: { checkIn: 'desc' },
  });
}

async function getBooking(bookingId, user) {
  const booking = await findBookingForUser(bookingId, user, {
    guest: { select: GUEST_FIELDS },
    room: true,
    idVerification: { select: { id: true, idType: true, status: true, reason: true } },
  });
  const { keyCode, ...rest } = booking;
  return { ...rest, hasDigitalKey: Boolean(keyCode), ...summary(booking) };
}

async function listGuests({ search }) {
  const has = { contains: search ?? '', mode: 'insensitive' };
  return prisma.guest.findMany({
    where: search ? { OR: [{ firstName: has }, { lastName: has }, { email: has }, { phone: has }] } : {},
    select: { ...GUEST_FIELDS, createdAt: true, _count: { select: { bookings: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

// The guest is at the front desk
async function checkInAtDesk(bookingId, user) {
  const booking = await findBookingForUser(bookingId, user);
  if (booking.status === 'PENDING') throw new AppError(409, 'BOOKING_NOT_PAID', 'This booking has not been paid');
  if (booking.status === 'CANCELLED' || booking.status === 'CHECKED_OUT') {
    throw new AppError(409, 'BOOKING_CLOSED', 'This booking is cancelled or already checked out');
  }
  return prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'CHECKED_IN' }, // already CHECKED_IN: stays the same
    omit: NO_KEY,
    include: { guest: { select: GUEST_FIELDS }, room: true },
  });
}

async function roomAvailability({ from, to }) {
  const rooms = await prisma.room.findMany({
    orderBy: { number: 'asc' },
    include: {
      bookings: {
        where: { ...overlaps(new Date(from), new Date(to)), status: { in: STAYING } },
        select: { id: true, checkIn: true, checkOut: true, status: true },
        orderBy: { checkIn: 'asc' },
      },
    },
  });
  return rooms.map(({ bookings, ...room }) => ({ ...room, bookedDates: bookings }));
}

module.exports = { overview, listBookings, getBooking, listGuests, checkInAtDesk, roomAvailability };

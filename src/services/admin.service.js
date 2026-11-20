// Staff dashboard: overview, bookings, guests, front-desk check-in, room availability.
// Every query is limited to the staff member's own hotel (user.hotelId).
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { hotelToday, hotelDay } = require('../utils/dates');
const { findBookingForUser, GUEST_FIELDS } = require('./booking.service');
const { summary } = require('./checkIn.service');

const STAYING = ['CONFIRMED', 'CHECKED_IN']; // bookings that hold a room

// Bookings whose stay overlaps from..to (check-out day doesn't count, as in the database rule)
const overlaps = (from, to) => ({ checkIn: { lte: to }, checkOut: { gt: from } });
const atHotel = (user) => ({ room: { hotelId: user.hotelId } });

async function overview(user, { date = hotelToday(user.hotel.timezone) }) {
  const day = new Date(date);
  const bookings = (where) => prisma.booking.count({ where: { ...atHotel(user), ...where } });
  const [arrivals, departures, occupied, rooms, openRequests, revenueToday] = await Promise.all([
    bookings({ checkIn: day, status: { in: STAYING } }),
    bookings({ checkOut: day, status: { in: [...STAYING, 'CHECKED_OUT'] } }),
    bookings({ checkIn: { lte: day }, checkOut: { gt: day }, status: { in: STAYING } }),
    prisma.room.count({ where: { hotelId: user.hotelId } }),
    prisma.serviceRequest.count({ where: { booking: atHotel(user), status: { in: ['SUBMITTED', 'IN_PROGRESS'] } } }),
    revenueOn(user, date),
  ]);
  return {
    date,
    arrivalsToday: arrivals,
    departuresToday: departures,
    occupancyRate: rooms ? Math.round((occupied / rooms) * 100) / 100 : 0, // 0.75 = 75% of rooms
    openRequests,
    revenueToday, // kobo, successful payments on this day (hotel time)
  };
}

// Sum of successful payments on a calendar day at the hotel
async function revenueOn(user, date) {
  const day = new Date(date).getTime();
  const payments = await prisma.payment.findMany({
    where: { status: 'SUCCESS', booking: atHotel(user), paidAt: { gte: new Date(day - 86400000), lt: new Date(day + 2 * 86400000) } },
    select: { amount: true, paidAt: true },
  });
  return payments
    .filter((p) => hotelDay(p.paidAt, user.hotel.timezone) === date)
    .reduce((sum, p) => sum + p.amount, 0);
}

async function listBookings(user, { status, from, to, search }) {
  const where = atHotel(user);
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
    include: { guest: { select: GUEST_FIELDS }, room: { include: { roomType: { select: { name: true } } } } },
    orderBy: { checkIn: 'desc' },
  });
}

async function getBooking(bookingId, user) {
  const booking = await findBookingForUser(bookingId, user, {
    guest: { select: GUEST_FIELDS },
    idVerification: { select: { id: true, idType: true, status: true, reason: true } },
    payments: { select: { reference: true, status: true, amount: true, channel: true, paidAt: true }, orderBy: { createdAt: 'desc' } },
  });
  return { ...booking, ...summary(booking) };
}

// Guests who have booked at this hotel, with how many times
async function listGuests(user, { search }) {
  const has = { contains: search ?? '', mode: 'insensitive' };
  const here = { bookings: { some: atHotel(user) } };
  return prisma.guest.findMany({
    where: search ? { ...here, OR: [{ firstName: has }, { lastName: has }, { email: has }, { phone: has }] } : here,
    select: { ...GUEST_FIELDS, createdAt: true, _count: { select: { bookings: { where: atHotel(user) } } } },
    orderBy: { createdAt: 'desc' },
  });
}

// The guest is at the front desk (PRD PC-07): no app or ID step needed
async function checkInAtDesk(bookingId, user) {
  const booking = await findBookingForUser(bookingId, user);
  if (booking.status === 'PENDING') throw new AppError(409, 'BOOKING_NOT_PAID', 'This booking has not been paid');
  if (booking.status === 'CANCELLED' || booking.status === 'CHECKED_OUT') {
    throw new AppError(409, 'BOOKING_CLOSED', 'This booking is cancelled or already checked out');
  }
  return prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'CHECKED_IN' }, // already CHECKED_IN: stays the same
    include: { guest: { select: GUEST_FIELDS }, room: { include: { roomType: { select: { name: true } } } } },
  });
}

async function roomAvailability(user, { from, to }) {
  const rooms = await prisma.room.findMany({
    where: { hotelId: user.hotelId },
    orderBy: { number: 'asc' },
    include: {
      roomType: { select: { id: true, name: true } },
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

// Concierge: guests ask for services, staff work through the requests.
// Status: OPEN -> IN_PROGRESS -> DONE, or CANCELLED.
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { findBookingForUser, GUEST_FIELDS } = require('./booking.service');

// Prices in kobo (0 = free). Placeholder list: confirm with the PM.
const SERVICES = [
  { code: 'ROOM_CLEANING', name: 'Room cleaning', price: 0 },
  { code: 'EXTRA_TOWELS', name: 'Extra towels', price: 0 },
  { code: 'LAUNDRY', name: 'Laundry', price: 500000 },
  { code: 'ROOM_SERVICE', name: 'Room service (food and drinks)', price: 0 },
  { code: 'SPA', name: 'Spa session', price: 1500000 },
  { code: 'AIRPORT_PICKUP', name: 'Airport pickup', price: 2500000 },
];
const SERVICE_CODES = SERVICES.map((s) => s.code);

// Which status can follow which
const NEXT_STATUSES = {
  OPEN: ['IN_PROGRESS', 'DONE', 'CANCELLED'],
  IN_PROGRESS: ['DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};
const ACTIVE_BOOKING = ['CONFIRMED', 'CHECKED_IN'];
const historyEntry = (status, user) => ({ status, at: new Date().toISOString(), by: user.role });

async function findRequestForUser(requestId, user, include = {}) {
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId }, include: { booking: true, ...include } });
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  if (user.role !== 'staff' && request.booking.guestId !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'This is not your request');
  }
  return request;
}

async function changeStatus(request, status, user) {
  if (!NEXT_STATUSES[request.status].includes(status)) {
    throw new AppError(409, 'INVALID_STATUS_CHANGE', `A ${request.status} request can't become ${status}`);
  }
  return prisma.serviceRequest.update({
    where: { id: request.id },
    data: { status, history: [...request.history, historyEntry(status, user)] },
  });
}

// ----- Guest -----

async function createRequest(bookingId, user, { serviceCode, note, scheduledFor }) {
  const booking = await findBookingForUser(bookingId, user);
  if (booking.status === 'PENDING') throw new AppError(409, 'BOOKING_NOT_PAID', 'Please pay for the booking first');
  if (!ACTIVE_BOOKING.includes(booking.status)) throw new AppError(409, 'BOOKING_CLOSED', 'This booking is cancelled or already checked out');

  const service = SERVICES.find((s) => s.code === serviceCode);
  return prisma.serviceRequest.create({
    data: { bookingId, serviceCode, price: service.price, note, scheduledFor, history: [historyEntry('OPEN', user)] },
  });
}

async function listForBooking(bookingId, user) {
  await findBookingForUser(bookingId, user);
  return prisma.serviceRequest.findMany({ where: { bookingId }, orderBy: { createdAt: 'desc' } });
}

async function getRequest(requestId, user) {
  const request = await findRequestForUser(requestId, user);
  delete request.booking; // the guest already has their booking
  return request;
}

async function cancelRequest(requestId, user) {
  const request = await findRequestForUser(requestId, user);
  if (request.status !== 'OPEN') throw new AppError(409, 'INVALID_STATUS_CHANGE', 'Only an OPEN request can be cancelled');
  return changeStatus(request, 'CANCELLED', user);
}

// ----- Staff -----

async function listAll({ status }) {
  return prisma.serviceRequest.findMany({
    where: status ? { status } : {},
    include: { booking: { include: { guest: { select: GUEST_FIELDS }, room: true } } },
    orderBy: { createdAt: 'asc' }, // oldest first: who has waited longest
  });
}

async function getForStaff(requestId, user) {
  return findRequestForUser(requestId, user, { booking: { include: { guest: { select: GUEST_FIELDS }, room: true } } });
}

async function updateStatus(requestId, user, { status }) {
  return changeStatus(await findRequestForUser(requestId, user), status, user);
}

module.exports = {
  SERVICES, SERVICE_CODES,
  createRequest, listForBooking, getRequest, cancelRequest,
  listAll, getForStaff, updateStatus,
};

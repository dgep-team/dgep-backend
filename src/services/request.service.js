// In-stay service requests (PRD IS-01 to IS-06).
// Status: SUBMITTED -> IN_PROGRESS -> COMPLETED. The guest can cancel until staff start.
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { findBookingForUser, checkBookingAccess, GUEST_FIELDS } = require('./booking.service');

// PRD IS-01. Free requests; paid add-ons (airport pickup, breakfast) come later with payments.
const CATEGORIES = [
  { code: 'TOWELS', name: 'Towels' },
  { code: 'TOILETRIES', name: 'Toiletries' },
  { code: 'HOUSEKEEPING', name: 'Housekeeping' },
  { code: 'MAINTENANCE', name: 'Maintenance or repair' },
  { code: 'ROOM_SERVICE', name: 'Room service' },
  { code: 'OTHER', name: 'Something else' },
];
const CATEGORY_CODES = CATEGORIES.map((c) => c.code);

// Which status can follow which (staff)
const NEXT_STATUSES = {
  SUBMITTED: ['IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};
const ACTIVE_BOOKING = ['CONFIRMED', 'CHECKED_IN'];
const STAFF_FIELDS = { id: true, firstName: true, lastName: true, role: true };
const STAFF_VIEW = {
  booking: { include: { guest: { select: GUEST_FIELDS }, room: true } },
  assignedTo: { select: STAFF_FIELDS },
};

const entry = (user, change) => ({ at: new Date().toISOString(), byId: user.id, byRole: user.role, ...change });

async function findRequestForUser(requestId, user, include = {}) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { booking: { include: { room: true } }, ...include },
  });
  checkBookingAccess(request && request.booking, user, 'Request');
  return request;
}

function save(request, data, include) {
  return prisma.serviceRequest.update({ where: { id: request.id }, data, include });
}

// ----- Guest -----

async function createRequest(bookingId, user, { category, note, preferredTime }) {
  const booking = await findBookingForUser(bookingId, user);
  if (booking.status === 'PENDING') throw new AppError(409, 'BOOKING_NOT_PAID', 'Please pay for the booking first');
  if (!ACTIVE_BOOKING.includes(booking.status)) throw new AppError(409, 'BOOKING_CLOSED', 'This booking is cancelled or already checked out');

  return prisma.serviceRequest.create({
    data: { bookingId, category, note, preferredTime, history: [entry(user, { status: 'SUBMITTED' })] },
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
  if (request.status !== 'SUBMITTED') {
    throw new AppError(409, 'INVALID_STATUS_CHANGE', 'Staff have already started this request');
  }
  return save(request, { status: 'CANCELLED', history: [...request.history, entry(user, { status: 'CANCELLED' })] });
}

// ----- Staff (always their own hotel) -----

async function listForHotel(user, { status, assignedTo }) {
  const where = { booking: { room: { hotelId: user.hotelId } } };
  if (status) where.status = status;
  if (assignedTo) where.assignedToId = assignedTo === 'me' ? user.id : assignedTo;
  return prisma.serviceRequest.findMany({ where, include: STAFF_VIEW, orderBy: { createdAt: 'asc' } }); // oldest first
}

function getForStaff(requestId, user) {
  return findRequestForUser(requestId, user, STAFF_VIEW);
}

async function updateStatus(requestId, user, { status }) {
  const request = await findRequestForUser(requestId, user);
  if (!NEXT_STATUSES[request.status].includes(status)) {
    throw new AppError(409, 'INVALID_STATUS_CHANGE', `A ${request.status} request can't become ${status}`);
  }
  return save(request, { status, history: [...request.history, entry(user, { status })] }, STAFF_VIEW);
}

// staffId null = unassign
async function assign(requestId, user, { staffId }) {
  const request = await findRequestForUser(requestId, user);
  if (['COMPLETED', 'CANCELLED'].includes(request.status)) {
    throw new AppError(409, 'REQUEST_CLOSED', `This request is already ${request.status}`);
  }
  if (staffId) {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.hotelId !== user.hotelId) throw new AppError(404, 'NOT_FOUND', 'Staff member not found');
  }
  return save(
    request,
    { assignedToId: staffId, history: [...request.history, entry(user, { assignedToId: staffId })] },
    STAFF_VIEW,
  );
}

module.exports = {
  CATEGORIES, CATEGORY_CODES,
  createRequest, listForBooking, getRequest, cancelRequest,
  listForHotel, getForStaff, updateStatus, assign,
};

const request = require('supertest');

jest.mock('../src/config/db', () => ({
  booking: { findUnique: jest.fn() },
  staff: { findUnique: jest.fn() },
  serviceRequest: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
}));
const prisma = require('../src/config/db');
const app = require('../src/app');

const GUEST = { 'X-User-Id': 'guest-1' };
const STAFF = { 'X-User-Id': 'staff-1', 'X-User-Role': 'staff' };
const me = (role = 'RECEPTION') => ({ id: 'staff-1', hotelId: 'h1', role, hotel: { id: 'h1', status: 'ACTIVE' } });
const booking = (fields = {}) => ({ id: 'b1', guestId: 'guest-1', status: 'CONFIRMED', room: { hotelId: 'h1' }, ...fields });
const serviceRequest = (fields = {}) => ({ id: 'r1', bookingId: 'b1', status: 'SUBMITTED', history: [], booking: booking(), ...fields });
const create = (body) => request(app).post('/api/v1/bookings/b1/requests').set(GUEST).send(body);
const echoUpdate = () => prisma.serviceRequest.update.mockImplementation(async ({ data }) => ({ id: 'r1', ...data }));

beforeEach(() => {
  jest.resetAllMocks();
  prisma.staff.findUnique.mockImplementation(async ({ where }) => (where.id === 'staff-1' ? me() : null));
});

describe('Guest', () => {
  it('lists the PRD categories', async () => {
    const res = await request(app).get('/api/v1/concierge/categories').set(GUEST);
    expect(res.body.data.map((c) => c.code)).toEqual(['TOWELS', 'TOILETRIES', 'HOUSEKEEPING', 'MAINTENANCE', 'ROOM_SERVICE', 'OTHER']);
  });

  it('creates a SUBMITTED request', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    prisma.serviceRequest.create.mockImplementation(async ({ data }) => ({ id: 'r1', status: 'SUBMITTED', ...data }));
    const res = await create({ category: 'TOWELS', note: 'Two please' });
    expect(res.status).toBe(201);
    expect(res.body.data.history[0]).toMatchObject({ status: 'SUBMITTED', byId: 'guest-1', byRole: 'guest' });
  });

  it('needs a note for OTHER', async () => {
    const res = await create({ category: 'OTHER' });
    expect(res.body.error.details[0]).toEqual({ field: 'note', message: 'Tell us what you need' });
  });

  it('rejects a preferred time in the past', async () => {
    const res = await create({ category: 'TOWELS', preferredTime: '2020-01-01T10:00:00+01:00' });
    expect(res.body.error.details[0].field).toBe('preferredTime');
  });

  it('needs a paid booking', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'PENDING' }));
    const res = await create({ category: 'TOWELS' });
    expect(res.body.error.code).toBe('BOOKING_NOT_PAID');
  });

  it('cancels before staff start', async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest());
    echoUpdate();
    const res = await request(app).patch('/api/v1/requests/r1/cancel').set(GUEST);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it("can't cancel once staff started", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest({ status: 'IN_PROGRESS' }));
    const res = await request(app).patch('/api/v1/requests/r1/cancel').set(GUEST);
    expect(res.body.error.code).toBe('INVALID_STATUS_CHANGE');
  });

  it("can't see someone else's request", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest({ booking: booking({ guestId: 'guest-2' }) }));
    const res = await request(app).get('/api/v1/requests/r1').set(GUEST);
    expect(res.status).toBe(403);
  });
});

describe('Staff', () => {
  it('lists only their hotel, oldest first, and "me" means my requests', async () => {
    prisma.serviceRequest.findMany.mockResolvedValue([]);
    await request(app).get('/api/v1/admin/requests?status=SUBMITTED&assignedTo=me').set(STAFF);
    const args = prisma.serviceRequest.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ booking: { room: { hotelId: 'h1' } }, status: 'SUBMITTED', assignedToId: 'staff-1' });
    expect(args.orderBy).toEqual({ createdAt: 'asc' });
  });

  it("can't open another hotel's request", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest({ booking: booking({ room: { hotelId: 'h2' } }) }));
    const res = await request(app).get('/api/v1/admin/requests/r1').set(STAFF);
    expect(res.status).toBe(404);
  });

  it('moves a request forward and records who did it', async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest({ history: [{ status: 'SUBMITTED' }] }));
    echoUpdate();
    const res = await request(app).patch('/api/v1/admin/requests/r1/status').set(STAFF).send({ status: 'IN_PROGRESS' });
    expect(res.body.data.history[1]).toMatchObject({ status: 'IN_PROGRESS', byId: 'staff-1', byRole: 'staff' });
  });

  it("can't reopen a COMPLETED request", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest({ status: 'COMPLETED' }));
    const res = await request(app).patch('/api/v1/admin/requests/r1/status').set(STAFF).send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(409);
  });

  it('assigns a request to a colleague at the same hotel', async () => {
    prisma.staff.findUnique.mockImplementation(async ({ where }) => (where.id === 'staff-1' ? me() : { id: 'staff-2', hotelId: 'h1' }));
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest());
    echoUpdate();
    const res = await request(app).patch('/api/v1/admin/requests/r1/assign').set(STAFF).send({ staffId: 'staff-2' });
    expect(res.body.data.assignedToId).toBe('staff-2');
    expect(res.body.data.history[0]).toMatchObject({ assignedToId: 'staff-2', byId: 'staff-1' });
  });

  it("can't assign to staff at another hotel", async () => {
    prisma.staff.findUnique.mockImplementation(async ({ where }) => (where.id === 'staff-1' ? me() : { id: 'staff-9', hotelId: 'h2' }));
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest());
    const res = await request(app).patch('/api/v1/admin/requests/r1/assign').set(STAFF).send({ staffId: 'staff-9' });
    expect(res.status).toBe(404);
  });

  it('housekeeping cannot assign', async () => {
    prisma.staff.findUnique.mockResolvedValue(me('HOUSEKEEPING'));
    const res = await request(app).patch('/api/v1/admin/requests/r1/assign').set(STAFF).send({ staffId: 'staff-2' });
    expect(res.status).toBe(403);
  });
});

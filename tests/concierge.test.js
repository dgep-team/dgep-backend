const request = require('supertest');

jest.mock('../src/config/db', () => ({
  booking: { findUnique: jest.fn() },
  serviceRequest: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
}));
const prisma = require('../src/config/db');
const app = require('../src/app');

const GUEST = { 'X-User-Id': 'guest-1' };
const STAFF = { 'X-User-Id': 'staff-1', 'X-User-Role': 'staff' };
const booking = (fields = {}) => ({ id: 'b1', guestId: 'guest-1', status: 'CONFIRMED', ...fields });
const serviceRequest = (fields = {}) => ({ id: 'r1', bookingId: 'b1', status: 'OPEN', history: [], booking: booking(), ...fields });
const create = (body) => request(app).post('/api/v1/bookings/b1/requests').set(GUEST).send(body);

beforeEach(() => jest.resetAllMocks());

describe('GET /concierge/services', () => {
  it('lists services with prices in kobo', async () => {
    const res = await request(app).get('/api/v1/concierge/services').set(GUEST);
    expect(res.status).toBe(200);
    expect(res.body.data).toContainEqual({ code: 'AIRPORT_PICKUP', name: 'Airport pickup', price: 2500000 });
  });
});

describe('POST /bookings/:id/requests', () => {
  it('creates an OPEN request with its price and first history entry', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    prisma.serviceRequest.create.mockImplementation(async ({ data }) => ({ id: 'r1', status: 'OPEN', ...data }));
    const res = await create({ serviceCode: 'LAUNDRY', note: 'Two shirts' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ serviceCode: 'LAUNDRY', price: 500000, status: 'OPEN' });
    expect(res.body.data.history[0]).toMatchObject({ status: 'OPEN', by: 'guest' });
  });

  it('rejects an unknown service', async () => {
    const res = await create({ serviceCode: 'HELICOPTER' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('serviceCode');
  });

  it('rejects a time in the past', async () => {
    const res = await create({ serviceCode: 'SPA', scheduledFor: '2020-01-01T10:00:00+01:00' });
    expect(res.body.error.details[0]).toEqual({ field: 'scheduledFor', message: 'Must be in the future' });
  });

  it('needs a paid booking', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'PENDING' }));
    const res = await create({ serviceCode: 'SPA' });
    expect(res.body.error.code).toBe('BOOKING_NOT_PAID');
  });

  it('is closed after check-out', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'CHECKED_OUT' }));
    const res = await create({ serviceCode: 'SPA' });
    expect(res.body.error.code).toBe('BOOKING_CLOSED');
  });
});

describe('Guest: one request', () => {
  it("can't see someone else's request", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest({ booking: booking({ guestId: 'guest-2' }) }));
    const res = await request(app).get('/api/v1/requests/r1').set(GUEST);
    expect(res.status).toBe(403);
  });

  it('cancels an OPEN request', async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest());
    prisma.serviceRequest.update.mockImplementation(async ({ data }) => ({ id: 'r1', ...data }));
    const res = await request(app).patch('/api/v1/requests/r1/cancel').set(GUEST);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it("can't cancel once staff started", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest({ status: 'IN_PROGRESS' }));
    const res = await request(app).patch('/api/v1/requests/r1/cancel').set(GUEST);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_CHANGE');
  });
});

describe('Staff: /admin/requests', () => {
  it('is for staff only', async () => {
    const res = await request(app).get('/api/v1/admin/requests').set(GUEST);
    expect(res.status).toBe(403);
  });

  it('lists requests, oldest first', async () => {
    prisma.serviceRequest.findMany.mockResolvedValue([]);
    await request(app).get('/api/v1/admin/requests?status=OPEN').set(STAFF);
    expect(prisma.serviceRequest.findMany.mock.calls[0][0]).toMatchObject({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' } });
  });

  it('moves a request forward and records it in the history', async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest({ history: [{ status: 'OPEN' }] }));
    prisma.serviceRequest.update.mockImplementation(async ({ data }) => ({ id: 'r1', ...data }));
    const res = await request(app).patch('/api/v1/admin/requests/r1/status').set(STAFF).send({ status: 'IN_PROGRESS' });
    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.history).toHaveLength(2);
    expect(res.body.data.history[1]).toMatchObject({ status: 'IN_PROGRESS', by: 'staff' });
  });

  it("can't reopen a DONE request", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(serviceRequest({ status: 'DONE' }));
    const res = await request(app).patch('/api/v1/admin/requests/r1/status').set(STAFF).send({ status: 'OPEN' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_CHANGE');
  });
});

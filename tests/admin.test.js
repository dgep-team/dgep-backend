const request = require('supertest');

jest.mock('../src/config/db', () => ({
  booking: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
  room: { count: jest.fn(), findMany: jest.fn() },
  guest: { findMany: jest.fn() },
  serviceRequest: { count: jest.fn() },
}));
const prisma = require('../src/config/db');
const app = require('../src/app');

const STAFF = { 'X-User-Id': 'staff-1', 'X-User-Role': 'staff' };
const get = (url) => request(app).get('/api/v1/admin' + url).set(STAFF);
const booking = (fields = {}) => ({ id: 'b1', guestId: 'guest-1', status: 'CONFIRMED', onlineCheckInAt: null, idVerification: null, keyCode: null, ...fields });

beforeEach(() => jest.resetAllMocks());

it('every /admin endpoint is for staff only', async () => {
  const res = await request(app).get('/api/v1/admin/overview').set({ 'X-User-Id': 'guest-1' });
  expect(res.status).toBe(403);
});

describe('GET /admin/overview', () => {
  it('counts today and works out occupancy', async () => {
    prisma.booking.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(3);
    prisma.room.count.mockResolvedValue(4);
    prisma.serviceRequest.count.mockResolvedValue(5);
    const res = await get('/overview?date=2026-12-01');
    expect(res.body.data).toEqual({
      date: '2026-12-01', arrivalsToday: 2, departuresToday: 1, occupancyRate: 0.75, openRequests: 5, revenueToday: null,
    });
  });

  it('rejects a bad date', async () => {
    const res = await get('/overview?date=01-12-2026');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /admin/bookings', () => {
  it('filters by status, dates and search text', async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    await get('/bookings?status=CONFIRMED&from=2026-12-01&to=2026-12-05&search=ada');
    const { where, omit } = prisma.booking.findMany.mock.calls[0][0];
    expect(where.status).toBe('CONFIRMED');
    expect(where.checkIn).toEqual({ lte: new Date('2026-12-05') });
    expect(where.checkOut).toEqual({ gt: new Date('2026-12-01') });
    expect(where.OR).toHaveLength(2);
    expect(omit).toEqual({ keyCode: true }); // staff never see the room key
  });
});

describe('GET /admin/bookings/:id', () => {
  it('adds payment, ID and check-in status, and hides the key', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ keyCode: 'secret', idVerification: { status: 'VERIFIED' } }));
    const res = await get('/bookings/b1');
    expect(res.body.data).toMatchObject({ paymentStatus: 'PAID', idVerificationStatus: 'VERIFIED', hasDigitalKey: true });
    expect(res.body.data.keyCode).toBeUndefined();
  });
});

describe('POST /admin/bookings/:id/check-in', () => {
  const deskCheckIn = () => request(app).post('/api/v1/admin/bookings/b1/check-in').set(STAFF);

  it('checks the guest in', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    prisma.booking.update.mockResolvedValue(booking({ status: 'CHECKED_IN' }));
    const res = await deskCheckIn();
    expect(res.body.data.status).toBe('CHECKED_IN');
    expect(prisma.booking.update.mock.calls[0][0].data).toEqual({ status: 'CHECKED_IN' });
  });

  it('needs payment first', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'PENDING' }));
    const res = await deskCheckIn();
    expect(res.body.error.code).toBe('BOOKING_NOT_PAID');
  });

  it('is closed for a cancelled booking', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'CANCELLED' }));
    const res = await deskCheckIn();
    expect(res.body.error.code).toBe('BOOKING_CLOSED');
  });
});

describe('GET /admin/guests', () => {
  it('returns guests with their booking count', async () => {
    prisma.guest.findMany.mockResolvedValue([]);
    await get('/guests?search=ada');
    const args = prisma.guest.findMany.mock.calls[0][0];
    expect(args.select._count).toEqual({ select: { bookings: true } });
    expect(args.where.OR).toHaveLength(4);
  });
});

describe('GET /admin/rooms/availability', () => {
  it('needs from and to, with to after from', async () => {
    const res = await get('/rooms/availability?from=2026-12-05&to=2026-12-01');
    expect(res.body.error.details[0]).toEqual({ field: 'to', message: 'Must be after from' });
  });

  it('lists each room with its booked dates', async () => {
    prisma.room.findMany.mockResolvedValue([{ id: 'r1', number: '204', bookings: [{ id: 'b1' }] }]);
    const res = await get('/rooms/availability?from=2026-12-01&to=2026-12-05');
    expect(res.body.data).toEqual([{ id: 'r1', number: '204', bookedDates: [{ id: 'b1' }] }]);
  });
});

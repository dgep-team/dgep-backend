const request = require('supertest');

jest.mock('../src/config/db', () => ({
  staff: { findUnique: jest.fn() },
  booking: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
  room: { count: jest.fn(), findMany: jest.fn() },
  guest: { findMany: jest.fn() },
  serviceRequest: { count: jest.fn() },
}));
const prisma = require('../src/config/db');
const app = require('../src/app');

const STAFF = { 'X-User-Id': 'staff-1', 'X-User-Role': 'staff' };
const get = (url) => request(app).get('/api/v1/admin' + url).set(STAFF);
const booking = (fields = {}) => ({
  id: 'b1', guestId: 'guest-1', status: 'CONFIRMED', onlineCheckInAt: null, idVerification: null, room: { hotelId: 'h1' }, ...fields,
});

beforeEach(() => {
  jest.resetAllMocks();
  prisma.staff.findUnique.mockResolvedValue({
    id: 'staff-1', hotelId: 'h1', role: 'RECEPTION', hotel: { id: 'h1', status: 'ACTIVE', timezone: 'Africa/Lagos' },
  });
});

it('every /admin endpoint is for staff only', async () => {
  const res = await request(app).get('/api/v1/admin/overview').set({ 'X-User-Id': 'guest-1' });
  expect(res.status).toBe(403);
});

describe('GET /admin/overview', () => {
  it("counts this hotel's day and works out occupancy", async () => {
    prisma.booking.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(3);
    prisma.room.count.mockResolvedValue(4);
    prisma.serviceRequest.count.mockResolvedValue(5);
    const res = await get('/overview?date=2026-12-01');
    expect(res.body.data).toEqual({
      date: '2026-12-01', arrivalsToday: 2, departuresToday: 1, occupancyRate: 0.75, openRequests: 5, revenueToday: null,
    });
    expect(prisma.room.count.mock.calls[0][0]).toEqual({ where: { hotelId: 'h1' } });
    expect(prisma.booking.count.mock.calls[0][0].where.room).toEqual({ hotelId: 'h1' });
  });

  it("uses today in the hotel's time zone by default", async () => {
    prisma.booking.count.mockResolvedValue(0);
    prisma.room.count.mockResolvedValue(0);
    prisma.serviceRequest.count.mockResolvedValue(0);
    const res = await get('/overview');
    const lagosToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
    expect(res.body.data.date).toBe(lagosToday);
  });

  it('rejects a bad date', async () => {
    const res = await get('/overview?date=01-12-2026');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /admin/bookings', () => {
  it('filters by hotel, status, dates and search text', async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    await get('/bookings?status=CONFIRMED&from=2026-12-01&to=2026-12-05&search=ada');
    const { where } = prisma.booking.findMany.mock.calls[0][0];
    expect(where.room).toEqual({ hotelId: 'h1' });
    expect(where.status).toBe('CONFIRMED');
    expect(where.checkIn).toEqual({ lte: new Date('2026-12-05') });
    expect(where.checkOut).toEqual({ gt: new Date('2026-12-01') });
    expect(where.OR).toHaveLength(2);
  });
});

describe('Front-desk check-in', () => {
  const deskCheckIn = () => request(app).post('/api/v1/admin/bookings/b1/check-in').set(STAFF);

  it('checks the guest in, no ID needed', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    prisma.booking.update.mockResolvedValue(booking({ status: 'CHECKED_IN' }));
    const res = await deskCheckIn();
    expect(res.body.data.status).toBe('CHECKED_IN');
  });

  it('needs payment first', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'PENDING' }));
    const res = await deskCheckIn();
    expect(res.body.error.code).toBe('BOOKING_NOT_PAID');
  });

  it("can't check in another hotel's guest", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ room: { hotelId: 'h2' } }));
    const res = await deskCheckIn();
    expect(res.status).toBe(404);
  });
});

describe('GET /admin/guests', () => {
  it("returns only this hotel's guests, with their booking count here", async () => {
    prisma.guest.findMany.mockResolvedValue([]);
    await get('/guests?search=ada');
    const args = prisma.guest.findMany.mock.calls[0][0];
    expect(args.where.bookings).toEqual({ some: { room: { hotelId: 'h1' } } });
    expect(args.select._count).toEqual({ select: { bookings: { where: { room: { hotelId: 'h1' } } } } });
  });
});

describe('GET /admin/rooms/availability', () => {
  it('needs to after from', async () => {
    const res = await get('/rooms/availability?from=2026-12-05&to=2026-12-01');
    expect(res.body.error.details[0]).toEqual({ field: 'to', message: 'Must be after from' });
  });

  it("lists this hotel's rooms with their booked dates", async () => {
    prisma.room.findMany.mockResolvedValue([{ id: 'r1', number: '204', bookings: [{ id: 'b1' }] }]);
    const res = await get('/rooms/availability?from=2026-12-01&to=2026-12-05');
    expect(res.body.data).toEqual([{ id: 'r1', number: '204', bookedDates: [{ id: 'b1' }] }]);
    expect(prisma.room.findMany.mock.calls[0][0].where).toEqual({ hotelId: 'h1' });
  });
});

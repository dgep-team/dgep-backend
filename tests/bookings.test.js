const request = require('supertest');

jest.mock('../src/config/db', () => ({
  roomType: { findUnique: jest.fn() },
  guest: { findUnique: jest.fn(), create: jest.fn() },
  booking: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
}));
const prisma = require('../src/config/db');
const app = require('../src/app');
const { readToken } = require('../src/utils/auth');

const GUEST = { 'X-User-Id': 'g1' };
const DAY = 86400000;
const inDays = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
const roomType = (fields = {}) => ({
  id: 't1', maxGuests: 2, pricePerNight: 1000000,
  hotel: { status: 'ACTIVE', timezone: 'Africa/Lagos', taxes: [{ name: 'VAT', percent: 7.5 }] },
  rooms: [{ id: 'r1' }, { id: 'r2' }], ...fields,
});
const body = (extra = {}) => ({ roomTypeId: 't1', checkIn: inDays(3), checkOut: inDays(5), ...extra });
const book = (b, headers = GUEST) => request(app).post('/api/v1/bookings').set(headers).send(b);
const overlapError = () => new Error('violates exclusion constraint "bookings_no_overlap"');

beforeEach(() => {
  jest.resetAllMocks();
  prisma.roomType.findUnique.mockResolvedValue(roomType());
  prisma.booking.findMany.mockResolvedValue([]);
  prisma.booking.create.mockImplementation(async ({ data }) => ({ id: 'b1', status: 'PENDING', createdAt: new Date(), ...data }));
});

describe('POST /bookings', () => {
  it('books a free room of the type at the all-in price', async () => {
    const res = await book(body());
    expect(res.status).toBe(201);
    expect(res.body.data.price).toMatchObject({ nights: 2, subtotal: 2000000, total: 2150000 });
    expect(prisma.booking.create.mock.calls[0][0].data).toMatchObject({ guestId: 'g1', roomId: 'r1', totalAmount: 2150000 });
    expect(res.body.data.booking.holdExpiresAt).toEqual(expect.any(String));
  });

  it('skips rooms that are already booked', async () => {
    prisma.booking.findMany.mockResolvedValue([{ roomId: 'r1' }]);
    await book(body());
    expect(prisma.booking.create.mock.calls[0][0].data.roomId).toBe('r2');
  });

  it('tries the next room if someone took one at the same moment', async () => {
    prisma.booking.create.mockRejectedValueOnce(overlapError());
    const res = await book(body());
    expect(res.status).toBe(201);
    expect(prisma.booking.create.mock.calls[1][0].data.roomId).toBe('r2');
  });

  it('says so when no room of the type is free', async () => {
    prisma.booking.findMany.mockResolvedValue([{ roomId: 'r1' }, { roomId: 'r2' }]);
    const res = await book(body());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_NOT_AVAILABLE');
  });

  it('releases unpaid holds older than 30 minutes first', async () => {
    await book(body());
    const { where, data } = prisma.booking.updateMany.mock.calls[0][0];
    expect(where.status).toBe('PENDING');
    expect(data).toEqual({ status: 'CANCELLED' });
  });

  it('refuses too many guests and past dates', async () => {
    expect((await book(body({ guests: 3 }))).body.error.code).toBe('TOO_MANY_GUESTS');
    expect((await book(body({ checkIn: inDays(-2), checkOut: inDays(1) }))).body.error.code).toBe('INVALID_DATES');
  });

  it("can't book a hotel that isn't live", async () => {
    prisma.roomType.findUnique.mockResolvedValue(roomType({ hotel: { status: 'PENDING' } }));
    expect((await book(body())).status).toBe(404);
  });
});

describe('Booking without an account (BR-09)', () => {
  const details = { email: 'new@guest.test', firstName: 'New', lastName: 'Guest' };

  it('creates the guest and returns a token for the next steps', async () => {
    prisma.guest.findUnique.mockResolvedValue(null);
    prisma.guest.create.mockResolvedValue({ id: 'g9' });
    const res = await book(body({ guest: details }), {});
    expect(res.status).toBe(201);
    expect(readToken(res.body.data.accessToken)).toEqual({ id: 'g9', role: 'guest' });
    expect(prisma.booking.create.mock.calls[0][0].data.guestId).toBe('g9');
  });

  it("won't book into an existing account", async () => {
    prisma.guest.findUnique.mockResolvedValue({ id: 'g1' });
    const res = await book(body({ guest: details }), {});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LOGIN_REQUIRED');
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('needs a login or guest details', async () => {
    expect((await book(body(), {})).status).toBe(401);
  });

  it("doesn't create a guest when no room is free", async () => {
    prisma.booking.findMany.mockResolvedValue([{ roomId: 'r1' }, { roomId: 'r2' }]);
    await book(body({ guest: details }), {});
    expect(prisma.guest.create).not.toHaveBeenCalled();
  });
});

describe('My bookings', () => {
  const mine = (fields = {}) => ({ id: 'b1', guestId: 'g1', status: 'CONFIRMED', createdAt: new Date(), checkIn: new Date(inDays(5)), room: { hotelId: 'h1', hotel: { timezone: 'Africa/Lagos' } }, ...fields });

  it('lists my bookings, newest first', async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    await request(app).get('/api/v1/bookings').set(GUEST);
    expect(prisma.booking.findMany.mock.calls[0][0]).toMatchObject({ where: { guestId: 'g1' }, orderBy: { createdAt: 'desc' } });
  });

  it('cancels before the check-in day', async () => {
    prisma.booking.findUnique.mockResolvedValue(mine());
    prisma.booking.update.mockResolvedValue(mine({ status: 'CANCELLED' }));
    const res = await request(app).patch('/api/v1/bookings/b1/cancel').set(GUEST);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it('is too late to cancel on the check-in day', async () => {
    prisma.booking.findUnique.mockResolvedValue(mine({ checkIn: new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())) }));
    const res = await request(app).patch('/api/v1/bookings/b1/cancel').set(GUEST);
    expect(res.body.error.code).toBe('TOO_LATE_TO_CANCEL');
  });

  it("can't open someone else's booking", async () => {
    prisma.booking.findUnique.mockResolvedValue(mine({ guestId: 'g2' }));
    const res = await request(app).get('/api/v1/bookings/b1').set(GUEST);
    expect(res.status).toBe(403);
  });
});

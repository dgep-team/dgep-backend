const request = require('supertest');

jest.mock('../src/config/db', () => ({
  hotel: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  staff: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  room: { create: jest.fn(), count: jest.fn() },
  roomType: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  booking: { findUnique: jest.fn() },
}));
const prisma = require('../src/config/db');
const app = require('../src/app');

const ADMIN = { 'X-User-Id': 'admin-1', 'X-User-Role': 'admin' };
const STAFF = { 'X-User-Id': 'staff-1', 'X-User-Role': 'staff' };
const hotel = (fields = {}) => ({ id: 'h1', status: 'ACTIVE', timezone: 'Africa/Lagos', ...fields });
const staffMember = (fields = {}) => ({ id: 'staff-1', hotelId: 'h1', role: 'MANAGER', hotel: hotel(), ...fields });
const newHotel = { name: 'Eko Suites', city: 'Lagos', address: '12 Marina Road' };

beforeEach(() => {
  jest.resetAllMocks();
  prisma.staff.findUnique.mockResolvedValue(staffMember());
});

describe('Platform: onboarding hotels', () => {
  it('is for the platform team only', async () => {
    const res = await request(app).post('/api/v1/platform/hotels').set(STAFF).send(newHotel);
    expect(res.status).toBe(403);
  });

  it('creates a hotel', async () => {
    prisma.hotel.create.mockImplementation(async ({ data }) => ({ id: 'h1', status: 'PENDING', ...data }));
    const res = await request(app).post('/api/v1/platform/hotels').set(ADMIN).send({ ...newHotel, timezone: 'Africa/Accra' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Eko Suites', status: 'PENDING', timezone: 'Africa/Accra' });
  });

  it('rejects an unknown time zone', async () => {
    const res = await request(app).post('/api/v1/platform/hotels').set(ADMIN).send({ ...newHotel, timezone: 'Mars/Base' });
    expect(res.body.error.details[0].field).toBe('timezone');
  });

  it("won't go live until the listing is complete (HS-01)", async () => {
    prisma.hotel.findUnique.mockResolvedValue(hotel({
      description: null, photos: [], roomTypes: [{ name: 'Deluxe', photos: [] }], _count: { rooms: 0, staff: 1 },
    }));
    const res = await request(app).patch('/api/v1/platform/hotels/h1/status').set(ADMIN).send({ status: 'ACTIVE' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HOTEL_NOT_READY');
    expect(res.body.error.details).toEqual([
      'Add a hotel description', 'Add at least one hotel photo', 'Add at least one room', 'Add a photo for room type "Deluxe"',
    ]);
  });

  it('goes live when the listing is complete', async () => {
    prisma.hotel.findUnique.mockResolvedValue(hotel({
      description: 'Lovely', photos: ['https://x.test/1.jpg'], roomTypes: [{ name: 'Deluxe', photos: ['https://x.test/2.jpg'] }], _count: { rooms: 2, staff: 1 },
    }));
    prisma.hotel.update.mockResolvedValue(hotel({ status: 'ACTIVE' }));
    const res = await request(app).patch('/api/v1/platform/hotels/h1/status').set(ADMIN).send({ status: 'ACTIVE' });
    expect(res.status).toBe(200);
  });

  it('adds the first manager', async () => {
    prisma.hotel.findUnique.mockResolvedValue(hotel({ status: 'PENDING' }));
    prisma.staff.create.mockImplementation(async ({ data }) => ({ id: 'staff-9', ...data }));
    const res = await request(app).post('/api/v1/platform/hotels/h1/staff').set(ADMIN)
      .send({ email: 'Ada@Eko.com', password: 'Password123!', firstName: 'Ada', lastName: 'Obi', role: 'MANAGER' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ hotelId: 'h1', email: 'ada@eko.com', role: 'MANAGER' });
  });
});

describe('Hotel staff', () => {
  it('a manager adds a room type and a room of that type', async () => {
    prisma.roomType.create.mockImplementation(async ({ data }) => ({ id: 't1', ...data }));
    const type = await request(app).post('/api/v1/admin/room-types').set(STAFF)
      .send({ name: 'Deluxe King', bedType: '1 king bed', maxGuests: 2, pricePerNight: 4500000, amenities: ['Wi-Fi'] });
    expect(type.status).toBe(201);
    expect(type.body.data).toMatchObject({ hotelId: 'h1', name: 'Deluxe King' });

    prisma.roomType.findUnique.mockResolvedValue({ id: 't1', hotelId: 'h1' });
    prisma.room.create.mockImplementation(async ({ data }) => ({ id: 'r1', ...data }));
    const room = await request(app).post('/api/v1/admin/rooms').set(STAFF).send({ number: '204', roomTypeId: 't1' });
    expect(room.status).toBe(201);
    expect(room.body.data).toMatchObject({ hotelId: 'h1', roomTypeId: 't1' });
  });

  it("can't add a room to another hotel's room type", async () => {
    prisma.roomType.findUnique.mockResolvedValue({ id: 't9', hotelId: 'h2' });
    const res = await request(app).post('/api/v1/admin/rooms').set(STAFF).send({ number: '204', roomTypeId: 't9' });
    expect(res.status).toBe(404);
  });

  it("can't edit another hotel's room type", async () => {
    prisma.roomType.updateMany.mockResolvedValue({ count: 0 });
    const res = await request(app).patch('/api/v1/admin/room-types/t9').set(STAFF).send({ pricePerNight: 1 });
    expect(res.status).toBe(404);
    expect(prisma.roomType.updateMany.mock.calls[0][0].where).toEqual({ id: 't9', hotelId: 'h1' });
  });

  it('only a manager can add rooms', async () => {
    prisma.staff.findUnique.mockResolvedValue(staffMember({ role: 'HOUSEKEEPING' }));
    const res = await request(app).post('/api/v1/admin/rooms').set(STAFF).send({ number: '204', roomTypeId: 't1' });
    expect(res.status).toBe(403);
  });

  it('rejects a tax over 100%', async () => {
    const res = await request(app).patch('/api/v1/admin/hotel').set(STAFF).send({ taxes: [{ name: 'VAT', percent: 750 }] });
    expect(res.body.error.details[0].field).toBe('taxes.0.percent');
  });

  it('an unknown staff id is not logged in', async () => {
    prisma.staff.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/admin/staff').set(STAFF);
    expect(res.status).toBe(401);
  });

  it('staff of a suspended hotel are blocked', async () => {
    prisma.staff.findUnique.mockResolvedValue(staffMember({ hotel: hotel({ status: 'SUSPENDED' }) }));
    const res = await request(app).get('/api/v1/admin/staff').set(STAFF);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('HOTEL_SUSPENDED');
  });

  it("staff can't see another hotel's booking", async () => {
    prisma.booking.findUnique.mockResolvedValue({ id: 'b1', guestId: 'g1', status: 'CONFIRMED', room: { hotelId: 'h2' } });
    const res = await request(app).get('/api/v1/bookings/b1/check-in').set(STAFF);
    expect(res.status).toBe(404); // looks like it doesn't exist
  });
});

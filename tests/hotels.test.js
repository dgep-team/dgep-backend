const request = require('supertest');

jest.mock('../src/config/db', () => ({
  hotel: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  staff: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  room: { create: jest.fn(), count: jest.fn() },
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

  it("won't go live without rooms and a manager", async () => {
    prisma.room.count.mockResolvedValue(0);
    prisma.staff.count.mockResolvedValue(1);
    const res = await request(app).patch('/api/v1/platform/hotels/h1/status').set(ADMIN).send({ status: 'ACTIVE' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'HOTEL_NOT_READY', details: { rooms: 0, managers: 1 } });
  });

  it('adds the first manager', async () => {
    prisma.hotel.findUnique.mockResolvedValue(hotel({ status: 'PENDING' }));
    prisma.staff.create.mockImplementation(async ({ data }) => ({ id: 'staff-9', ...data }));
    const res = await request(app).post('/api/v1/platform/hotels/h1/staff').set(ADMIN)
      .send({ email: 'Ada@Eko.com', firstName: 'Ada', lastName: 'Obi', role: 'MANAGER' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ hotelId: 'h1', email: 'ada@eko.com', role: 'MANAGER' });
  });
});

describe('Hotel staff', () => {
  it('a manager adds a room to their own hotel', async () => {
    prisma.room.create.mockImplementation(async ({ data }) => ({ id: 'r1', ...data }));
    const res = await request(app).post('/api/v1/admin/rooms').set(STAFF).send({ number: '204', type: 'Deluxe', pricePerNight: 4500000 });
    expect(res.status).toBe(201);
    expect(res.body.data.hotelId).toBe('h1');
  });

  it('only a manager can add rooms', async () => {
    prisma.staff.findUnique.mockResolvedValue(staffMember({ role: 'HOUSEKEEPING' }));
    const res = await request(app).post('/api/v1/admin/rooms').set(STAFF).send({ number: '204', type: 'Deluxe', pricePerNight: 4500000 });
    expect(res.status).toBe(403);
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

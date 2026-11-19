const request = require('supertest');

jest.mock('../src/config/db', () => ({
  booking: { findUnique: jest.fn(), update: jest.fn() },
}));
const prisma = require('../src/config/db');
const app = require('../src/app');

const GUEST = { 'X-User-Id': 'guest-1' };
const booking = (fields = {}) => ({
  id: 'b1', guestId: 'guest-1', status: 'CONFIRMED', onlineCheckInAt: null,
  idVerification: { status: 'VERIFIED' }, ...fields,
});
const checkIn = (body = { arrivalTime: '14:30' }) =>
  request(app).post('/api/v1/bookings/b1/check-in').set(GUEST).send(body);

beforeEach(() => jest.resetAllMocks());

describe('GET /bookings/:id/check-in', () => {
  it('needs a logged-in user', async () => {
    const res = await request(app).get('/api/v1/bookings/b1/check-in');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it("blocks someone else's booking", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ guestId: 'guest-2' }));
    const res = await request(app).get('/api/v1/bookings/b1/check-in').set(GUEST);
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown booking', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/bookings/b1/check-in').set(GUEST);
    expect(res.status).toBe(404);
  });

  it('shows each step of check-in', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'PENDING', idVerification: null }));
    const res = await request(app).get('/api/v1/bookings/b1/check-in').set(GUEST);
    expect(res.body.data).toEqual({
      paymentStatus: 'UNPAID',
      idVerificationStatus: 'NOT_SUBMITTED',
      checkInStatus: 'NOT_STARTED',
      canCheckIn: false,
    });
  });
});

describe('POST /bookings/:id/check-in', () => {
  it('rejects a bad arrival time', async () => {
    const res = await checkIn({ arrivalTime: '2pm' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('arrivalTime');
  });

  it('needs payment first', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'PENDING' }));
    const res = await checkIn();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_NOT_PAID');
  });

  it('is closed for a cancelled booking', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'CANCELLED' }));
    const res = await checkIn();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_CLOSED');
  });

  it('needs a verified ID', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ idVerification: { status: 'PENDING' } }));
    const res = await checkIn();
    expect(res.body.error.code).toBe('ID_NOT_VERIFIED');
  });

  it('completes check-in', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    prisma.booking.update.mockResolvedValue(booking({ onlineCheckInAt: new Date() }));
    const res = await checkIn({ arrivalTime: '14:30', specialRequests: 'Late arrival' });
    expect(res.status).toBe(200);
    expect(res.body.data.checkInStatus).toBe('COMPLETED');
    expect(prisma.booking.update.mock.calls[0][0].data).toMatchObject({
      arrivalTime: '14:30', specialRequests: 'Late arrival',
    });
  });
});

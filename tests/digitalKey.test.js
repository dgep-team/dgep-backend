const request = require('supertest');

jest.mock('../src/config/db', () => ({ booking: { findUnique: jest.fn() } }));
const prisma = require('../src/config/db');
const app = require('../src/app');
const { checkKeyActive } = require('../src/services/digitalKey.service');

const GUEST = { 'X-User-Id': 'guest-1' };
const DAY = 24 * 60 * 60 * 1000;
const midnightUtc = (daysFromToday) => new Date(new Date().setUTCHours(0, 0, 0, 0) + daysFromToday * DAY);

// A guest staying from yesterday to tomorrow, already checked in online
const booking = (fields = {}) => ({
  id: 'b1', guestId: 'guest-1', status: 'CONFIRMED', keyCode: 'secret-code',
  onlineCheckInAt: new Date(), checkIn: midnightUtc(-1), checkOut: midnightUtc(1),
  room: { number: '204' }, ...fields,
});

beforeEach(() => jest.resetAllMocks());

describe('Key time window (Lagos, UTC+1)', () => {
  const stay = booking({ checkIn: new Date('2026-12-01'), checkOut: new Date('2026-12-03') });

  it('starts at 00:00 on the check-in day', () => {
    expect(() => checkKeyActive(stay, new Date('2026-11-30T22:59:00Z'))).toThrow('during your stay');
    expect(checkKeyActive(stay, new Date('2026-11-30T23:00:00Z')).validFrom).toEqual(new Date('2026-11-30T23:00:00Z'));
  });

  it('ends at 12:00 noon on the check-out day', () => {
    expect(checkKeyActive(stay, new Date('2026-12-03T11:00:00Z')).validUntil).toEqual(new Date('2026-12-03T11:00:00Z'));
    expect(() => checkKeyActive(stay, new Date('2026-12-03T11:01:00Z'))).toThrow('during your stay');
  });
});

describe('GET /bookings/:id/key', () => {
  it('returns the key during the stay', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    const res = await request(app).get('/api/v1/bookings/b1/key').set(GUEST);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ keyId: 'b1', roomNumber: '204', qrCode: 'secret-code' });
  });

  it('is not active before online check-in', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ onlineCheckInAt: null }));
    const res = await request(app).get('/api/v1/bookings/b1/key').set(GUEST);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('KEY_NOT_ACTIVE');
  });

  it('is not active after check-out', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'CHECKED_OUT' }));
    const res = await request(app).get('/api/v1/bookings/b1/key').set(GUEST);
    expect(res.body.error.code).toBe('KEY_NOT_ACTIVE');
  });

  it('is not active before the stay starts', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ checkIn: midnightUtc(5), checkOut: midnightUtc(7) }));
    const res = await request(app).get('/api/v1/bookings/b1/key').set(GUEST);
    expect(res.body.error.code).toBe('KEY_NOT_ACTIVE');
  });
});

describe('POST /bookings/:id/key/unlock', () => {
  it('unlocks during the stay', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    const res = await request(app).post('/api/v1/bookings/b1/key/unlock').set(GUEST);
    expect(res.status).toBe(200);
    expect(res.body.data.result).toBe('UNLOCKED');
  });

  it("can't open someone else's room", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ guestId: 'guest-2' }));
    const res = await request(app).post('/api/v1/bookings/b1/key/unlock').set(GUEST);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

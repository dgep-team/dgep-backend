const request = require('supertest');

jest.mock('../src/config/db', () => ({
  booking: { findUnique: jest.fn() },
  idVerification: { upsert: jest.fn(), findMany: jest.fn(), update: jest.fn() },
}));
jest.mock('../src/services/storage.service', () => ({
  uploadFile: jest.fn(async (bucket, key) => key),
  getFileUrl: jest.fn(async (bucket, key) => `https://storage.test/${key}?signed`),
}));
const prisma = require('../src/config/db');
const app = require('../src/app');

const GUEST = { 'X-User-Id': 'guest-1' };
const STAFF = { 'X-User-Id': 'staff-1', 'X-User-Role': 'staff' };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const booking = (fields = {}) => ({ id: 'b1', guestId: 'guest-1', status: 'CONFIRMED', idVerification: null, ...fields });

const upload = (image = JPEG, fields = { idType: 'NIN', idNumber: '12345678901' }) => {
  const req = request(app).post('/api/v1/bookings/b1/id-verification').set(GUEST);
  Object.entries(fields).forEach(([k, v]) => req.field(k, v));
  return image ? req.attach('idImage', image, 'id.jpg') : req;
};

beforeEach(() => jest.clearAllMocks());

describe('POST /bookings/:id/id-verification', () => {
  it('saves the photo and sets status PENDING', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    prisma.idVerification.upsert.mockResolvedValue({ id: 'v1', status: 'PENDING' });
    const res = await upload();
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ verificationId: 'v1', status: 'PENDING' });
    const saved = prisma.idVerification.upsert.mock.calls[0][0].create;
    expect(saved.idImageKey).toMatch(/^bookings\/b1\/.+\/id$/);
  });

  it('needs the ID photo', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    const res = await upload(null);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'idImage', message: 'Required' }]);
  });

  it('rejects a file that is not an image', async () => {
    const res = await upload(Buffer.from('not an image'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE');
  });

  it('rejects a file over 5 MB with 413', async () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024)]);
    const res = await upload(big);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('is closed for a cancelled booking', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'CANCELLED' }));
    const res = await upload();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_CLOSED');
  });

  it('rejects an unknown ID type', async () => {
    const res = await upload(JPEG, { idType: 'LIBRARY_CARD', idNumber: '12345' });
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not replace a verified ID', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ idVerification: { status: 'VERIFIED' } }));
    const res = await upload();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ID_ALREADY_VERIFIED');
  });
});

describe('GET /bookings/:id/id-verification', () => {
  it('shows the reason when the ID failed', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ idVerification: { id: 'v1', status: 'FAILED', reason: 'Blurry photo' } }));
    const res = await request(app).get('/api/v1/bookings/b1/id-verification').set(GUEST);
    expect(res.body.data).toEqual({ verificationId: 'v1', status: 'FAILED', reason: 'Blurry photo' });
  });
});

describe('Staff: /admin/id-verifications', () => {
  it('is for staff only', async () => {
    const res = await request(app).get('/api/v1/admin/id-verifications').set(GUEST);
    expect(res.status).toBe(403);
  });

  it('lists verifications with short-lived photo links', async () => {
    prisma.idVerification.findMany.mockResolvedValue([{ id: 'v1', idImageKey: 'k/id', selfieKey: null }]);
    const res = await request(app).get('/api/v1/admin/id-verifications?status=PENDING').set(STAFF);
    expect(res.body.data).toEqual([{ id: 'v1', idImageUrl: 'https://storage.test/k/id?signed', selfieUrl: null }]);
    expect(prisma.idVerification.findMany.mock.calls[0][0].where).toEqual({ status: 'PENDING' });
  });

  it('needs a reason to fail an ID', async () => {
    const res = await request(app).patch('/api/v1/admin/id-verifications/v1').set(STAFF).send({ status: 'FAILED' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('reason');
  });

  it('marks an ID as verified', async () => {
    prisma.idVerification.update.mockResolvedValue({ id: 'v1', status: 'VERIFIED', idImageKey: 'k/id', selfieKey: null });
    const res = await request(app).patch('/api/v1/admin/id-verifications/v1').set(STAFF).send({ status: 'VERIFIED' });
    expect(res.status).toBe(200);
    expect(prisma.idVerification.update.mock.calls[0][0].data).toEqual({ status: 'VERIFIED', reason: null, reviewedBy: 'staff-1' });
  });
});

const request = require('supertest');

jest.mock('../src/config/db', () => ({
  guest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  staff: { findUnique: jest.fn() },
  platformAdmin: { findUnique: jest.fn() },
}));
const prisma = require('../src/config/db');
const app = require('../src/app');
const { hashPassword, signToken } = require('../src/utils/auth');

let hash;
beforeAll(async () => { hash = await hashPassword('Password123!'); });
beforeEach(() => jest.resetAllMocks());

const bearer = (user) => ({ Authorization: `Bearer ${signToken(user)}` });

describe('Guests', () => {
  it('registers and gets a token', async () => {
    prisma.guest.findUnique.mockResolvedValue(null);
    prisma.guest.create.mockImplementation(async ({ data }) => ({ id: 'g1', email: data.email }));
    const res = await request(app).post('/api/v1/auth/register')
      .send({ email: 'Ada@Test.com', password: 'Password123!', firstName: 'Ada', lastName: 'Obi' });
    expect(res.status).toBe(201);
    expect(res.body.data.guest).toEqual({ id: 'g1', email: 'ada@test.com' });
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(prisma.guest.create.mock.calls[0][0].data.passwordHash).not.toBe('Password123!'); // stored hashed
  });

  it('rejects a short password', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'a@b.com', password: 'short', firstName: 'A', lastName: 'B' });
    expect(res.body.error.details[0]).toEqual({ field: 'password', message: 'Use at least 8 characters' });
  });

  it('logs in with the right password, never returning the hash', async () => {
    prisma.guest.findUnique.mockResolvedValue({ id: 'g1', email: 'ada@test.com', passwordHash: hash });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'ada@test.com', password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.guest).toEqual({ id: 'g1', email: 'ada@test.com' });
  });

  it('refuses a wrong password with the same message as an unknown email', async () => {
    prisma.guest.findUnique.mockResolvedValueOnce({ id: 'g1', passwordHash: hash }).mockResolvedValueOnce(null);
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: 'ada@test.com', password: 'nope' });
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'who@test.com', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('a guest who booked without an account can set a password', async () => {
    prisma.guest.findUnique.mockResolvedValue({ id: 'g1', passwordHash: null });
    const res = await request(app).post('/api/v1/auth/password').set(bearer({ id: 'g1', role: 'guest' })).send({ password: 'NewPassword1' });
    expect(res.body.data).toEqual({ passwordSet: true });
  });

  it('changing a password needs the current one', async () => {
    prisma.guest.findUnique.mockResolvedValue({ id: 'g1', passwordHash: hash });
    const res = await request(app).post('/api/v1/auth/password').set(bearer({ id: 'g1', role: 'guest' })).send({ password: 'NewPassword1' });
    expect(res.status).toBe(401);
  });

  it('GET /me works with a token and refuses a bad one', async () => {
    prisma.guest.findUnique.mockResolvedValue({ id: 'g1', firstName: 'Ada' });
    const ok = await request(app).get('/api/v1/me').set(bearer({ id: 'g1', role: 'guest' }));
    expect(ok.body.data.firstName).toBe('Ada');
    const bad = await request(app).get('/api/v1/me').set({ Authorization: 'Bearer not-a-token' });
    expect(bad.status).toBe(401);
  });
});

describe('Staff and platform team', () => {
  it('staff log in and their token works on /admin', async () => {
    const staff = { id: 's1', hotelId: 'h1', role: 'MANAGER', passwordHash: hash, hotel: { id: 'h1', status: 'ACTIVE' } };
    prisma.staff.findUnique.mockResolvedValue(staff);
    const res = await request(app).post('/api/v1/admin/auth/login').send({ email: 'm@eko.test', password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.staff.passwordHash).toBeUndefined();
    // the token is accepted by a staff-only endpoint (403 here only because of the staff role check, not 401)
    const me = await request(app).post('/api/v1/admin/staff').set({ Authorization: `Bearer ${res.body.data.accessToken}` }).send({});
    expect(me.status).toBe(400); // got past login and role checks, failed validation
  });

  it("staff of a suspended hotel can't log in", async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: 's1', passwordHash: hash, hotel: { status: 'SUSPENDED' } });
    const res = await request(app).post('/api/v1/admin/auth/login').send({ email: 'm@eko.test', password: 'Password123!' });
    expect(res.body.error.code).toBe('HOTEL_SUSPENDED');
  });

  it('a guest token is refused on platform endpoints', async () => {
    const res = await request(app).get('/api/v1/platform/hotels').set(bearer({ id: 'g1', role: 'guest' }));
    expect(res.status).toBe(403);
  });

  it('the platform team logs in', async () => {
    prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'a1', email: 'admin@dgep.test', passwordHash: hash });
    const res = await request(app).post('/api/v1/platform/auth/login').send({ email: 'admin@dgep.test', password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.admin).toEqual({ id: 'a1', email: 'admin@dgep.test' });
  });
});

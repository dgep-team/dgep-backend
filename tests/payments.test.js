const crypto = require('crypto');
const request = require('supertest');

jest.mock('../src/config/db', () => ({
  booking: { findUnique: jest.fn(), updateMany: jest.fn() },
  payment: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
}));
const prisma = require('../src/config/db');
const config = require('../src/config');
const app = require('../src/app');

const GUEST = { 'X-User-Id': 'g1' };
const booking = (fields = {}) => ({
  id: 'b1', guestId: 'g1', status: 'PENDING', totalAmount: 2150000, createdAt: new Date(),
  guest: { email: 'john@guest.test' }, room: { hotelId: 'h1', hotel: { paystackSubaccount: 'ACCT_eko' } }, ...fields,
});
const payment = (fields = {}) => ({ id: 'p1', bookingId: 'b1', reference: 'DGEP-1', amount: 2150000, status: 'INITIATED', ...fields });
const paystackAnswers = (data) =>
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ status: true, data }) });
const tx = (fields = {}) => ({ status: 'success', amount: 2150000, currency: 'NGN', paid_at: '2026-11-20T10:00:00Z', channel: 'card', ...fields });

beforeEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
  config.paystackSecret = 'sk_test_fake';
  prisma.booking.findUnique.mockResolvedValue(booking());
});

describe('POST /bookings/:id/payments', () => {
  it("starts a Paystack payment for the booking's all-in amount", async () => {
    const fetch = paystackAnswers({ authorization_url: 'https://checkout.paystack.com/abc' });
    const res = await request(app).post('/api/v1/bookings/b1/payments').set(GUEST);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ authorizationUrl: 'https://checkout.paystack.com/abc', reference: expect.stringMatching(/^DGEP-/) });
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sent).toMatchObject({ email: 'john@guest.test', amount: 2150000, currency: 'NGN', subaccount: 'ACCT_eko', metadata: { bookingId: 'b1' } });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer sk_test_fake');
  });

  it("won't take payment twice", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: 'CONFIRMED' }));
    expect((await request(app).post('/api/v1/bookings/b1/payments').set(GUEST)).body.error.code).toBe('BOOKING_CLOSED');
  });

  it('refuses after the 30-minute hold', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ createdAt: new Date(Date.now() - 31 * 60000) }));
    expect((await request(app).post('/api/v1/bookings/b1/payments').set(GUEST)).body.error.code).toBe('HOLD_EXPIRED');
  });

  it('answers 503 when Paystack is not set up', async () => {
    config.paystackSecret = undefined;
    const res = await request(app).post('/api/v1/bookings/b1/payments').set(GUEST);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PAYMENTS_NOT_CONFIGURED');
  });
});

describe('GET /payments/verify/:reference', () => {
  const verify = () => request(app).get('/api/v1/payments/verify/DGEP-1').set(GUEST);

  it('confirms the booking when Paystack says success', async () => {
    paystackAnswers(tx());
    prisma.payment.findUnique.mockResolvedValueOnce(payment()).mockResolvedValueOnce(payment()).mockResolvedValue(payment({ status: 'SUCCESS' }));
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.booking.findUnique.mockResolvedValueOnce(booking()).mockResolvedValue(booking({ status: 'CONFIRMED' }));
    const res = await verify();
    expect(res.body.data.status).toBe('success');
    expect(prisma.booking.updateMany.mock.calls[0][0].data).toEqual({ status: 'CONFIRMED' });
  });

  it("doesn't confirm if the amount paid is too small", async () => {
    paystackAnswers(tx({ amount: 100 }));
    prisma.payment.findUnique.mockResolvedValue(payment());
    const res = await verify();
    expect(res.body.data.status).toBe('pending');
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('a failed payment leaves the booking open to retry', async () => {
    paystackAnswers(tx({ status: 'failed' }));
    prisma.payment.findUnique.mockResolvedValueOnce(payment()).mockResolvedValueOnce(payment()).mockResolvedValue(payment({ status: 'FAILED' }));
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    const res = await verify();
    expect(res.body.data.status).toBe('failed');
    expect(prisma.payment.updateMany.mock.calls[0][0].data).toEqual({ status: 'FAILED' });
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('is applied once: a second report changes nothing', async () => {
    paystackAnswers(tx());
    prisma.payment.findUnique.mockResolvedValue(payment({ status: 'SUCCESS' }));
    prisma.payment.updateMany.mockResolvedValue({ count: 0 }); // the webhook got there first
    await verify();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });
});

describe('POST /payments/webhook', () => {
  const event = { event: 'charge.success', data: { reference: 'DGEP-1', ...tx() } };
  const sign = (body, key = 'sk_test_fake') => crypto.createHmac('sha512', key).update(body).digest('hex');
  const send = (signature) => request(app).post('/api/v1/payments/webhook').set('Content-Type', 'application/json')
    .set('x-paystack-signature', signature).send(JSON.stringify(event));

  it('accepts a real Paystack event and confirms the booking', async () => {
    prisma.payment.findUnique.mockResolvedValue(payment());
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    const res = await send(sign(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect(prisma.booking.updateMany).toHaveBeenCalled();
  });

  it('refuses a fake signature', async () => {
    const res = await send(sign(JSON.stringify(event), 'someone-elses-key'));
    expect(res.status).toBe(401);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });
});

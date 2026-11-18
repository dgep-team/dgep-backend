const express = require('express');
const request = require('supertest');
const app = require('../src/app');
const AppError = require('../src/utils/AppError');
const asyncHandler = require('../src/utils/asyncHandler');
const errorHandler = require('../src/middleware/errorHandler');

describe('Unknown route', () => {
  it('returns 404 in the standard error format', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route GET /api/v1/does-not-exist not found' },
    });
  });
});

describe('Invalid JSON body', () => {
  it('returns 400 INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/v1/anything')
      .set('Content-Type', 'application/json')
      .send('{ bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('Error handler', () => {
  // A small test app with routes that throw on purpose
  const testApp = express();
  testApp.get('/app-error', asyncHandler(async () => {
    throw new AppError(409, 'ROOM_TAKEN', 'Room not available', { roomId: 12 });
  }));
  testApp.get('/bug', asyncHandler(async () => {
    throw new Error('something broke');
  }));
  testApp.use(errorHandler);

  it('turns an AppError into its status and code', async () => {
    const res = await request(testApp).get('/app-error');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'ROOM_TAKEN', message: 'Room not available', details: { roomId: 12 } },
    });
  });

  it('turns an unexpected error into 500 INTERNAL_ERROR', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(testApp).get('/bug');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    console.error.mockRestore();
  });
});

describe('Database errors', () => {
  const dbApp = (err) => {
    const a = express();
    a.get('/', asyncHandler(async () => { throw err; }));
    a.use(errorHandler);
    return a;
  };
  const withCode = (code) => Object.assign(new Error('prisma error'), { code });

  it('maps a double booking to 409 ROOM_NOT_AVAILABLE', async () => {
    const err = new Error('violates exclusion constraint "bookings_no_overlap"');
    const res = await request(dbApp(err)).get('/');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_NOT_AVAILABLE');
  });

  it('maps backwards dates to 400 INVALID_DATES', async () => {
    const err = new Error('violates check constraint "bookings_dates_check"');
    const res = await request(dbApp(err)).get('/');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DATES');
  });

  it('maps a duplicate value (P2002) to 409 ALREADY_EXISTS', async () => {
    const res = await request(dbApp(withCode('P2002'))).get('/');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_EXISTS');
  });

  it('maps a missing record (P2025) to 404 NOT_FOUND', async () => {
    const res = await request(dbApp(withCode('P2025'))).get('/');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

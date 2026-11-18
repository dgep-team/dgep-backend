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

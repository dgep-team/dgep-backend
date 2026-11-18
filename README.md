# dgep-backend

Node.js backend for the Digital Guest Experience Platform.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your values
npm run dev            # starts on http://localhost:3000
```

- `npm test`: run tests
- `npm run lint`: check code style

## Folder structure

```
src/
  app.js          Express app: middleware and routes
  server.js       Starts the server
  config/         Settings read from .env (import config, not process.env)
  routes/         URL -> controller. Feature routes go under /api/v1
  controllers/    Read the request, call a service, send the response
  services/       Business logic (database, Paystack, etc.)
  middleware/     Runs before/after routes (auth, errors, 404)
  utils/          Shared helpers (AppError, sendSuccess, asyncHandler)
tests/            Jest + supertest tests
```

## Adding a feature (example: bookings)

1. `src/services/booking.service.js`: the logic
2. `src/controllers/booking.controller.js`: calls the service, uses `sendSuccess`
3. `src/routes/booking.routes.js`: wrap async controllers in `asyncHandler`
4. In `src/routes/index.js`: `router.use('/bookings', require('./booking.routes'));`
5. Add tests in `tests/`

## Response format

Every response uses the same shape.

Success:

```json
{ "success": true, "data": { "bookingId": 42 } }
```

Error:

```json
{ "success": false, "error": { "code": "ROOM_TAKEN", "message": "Room not available" } }
```

For expected errors, throw an `AppError` and the error handler formats it:

```js
throw new AppError(409, 'ROOM_TAKEN', 'Room not available');
```

Unexpected errors return `500 INTERNAL_ERROR`. In production, the message is hidden.

## Workflow

One branch per Jira ticket (`SCRUM-21-api-structure`), then a PR into `main`. A PR needs 1 approval and a passing "Lint and test" check.

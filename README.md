# dgep-backend

Node.js backend for the Digital Guest Experience Platform.

## Getting started

```bash
npm install
cp .env.example .env   # add the two DATABASE_URL values
npm run db:deploy      # create the tables
npm run dev
```

After changing `prisma/schema.prisma`, run `npm run db:migrate -- --name <what-changed>` and commit the new migration.

## Demo data

```bash
npm run db:seed   # 3 hotels, staff, rooms, guests, bookings and requests
```

Safe to run again (fixed ids, nothing duplicated). It prints the ids to use as
`X-User-Id`. Bookings are relative to today, so the dashboard always has data.

## Folder structure

```
src/
  config/         Settings from .env
  routes/         URL -> controller (features under /api/v1)
  controllers/    Handle the request and response
  services/       Business logic
  middleware/     Auth, errors, 404
  utils/          AppError, sendSuccess, asyncHandler
```

## Response format

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "ROOM_TAKEN", "message": "Room not available" } }
```

## Testing with Postman

Import the files in `postman/` (Postman > Import), then set the collection
variables `guestId` and `bookingId`.

Until real login (SCRUM-27), send headers instead of a token:

| Who | Headers |
|---|---|
| Guest | `X-User-Id: <guest id>` |
| Hotel staff | `X-User-Id: <staff id>`, `X-User-Role: staff` (sees only their hotel) |
| Platform team | `X-User-Id: <any id>`, `X-User-Role: admin` (onboards hotels) |

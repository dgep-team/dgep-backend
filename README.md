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

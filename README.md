# dgep-backend

Node.js backend for the Digital Guest Experience Platform.

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

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

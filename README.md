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

## API docs (Swagger) for the frontend

- **Try it in the browser:** https://dgep-backend-staging.onrender.com/api/docs (locally: http://localhost:3000/api/docs).
  Log in with one of the login endpoints, copy `accessToken`, click **Authorize** and paste it.
- **Raw spec:** `/api/openapi.json`, for code generators or Postman (Import > Link).
- **Source:** `docs/openapi.yaml`. When you add or change a route, update it there:
  `tests/docs.test.js` fails if a route is missing from the docs.
- The browser can call the API from any site. To allow only the frontend, set `CORS_ORIGINS` on Render.

## Testing with Postman

Import `postman/DGEP-backend.postman_collection.json` (Postman > Import). It points at
staging, which has the demo data. Run **0. Log in** first: the tokens are saved and
used by the other folders.



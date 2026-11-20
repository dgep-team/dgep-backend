// One shared database client for the whole app.
//
//   const prisma = require('../config/db');
//   const rooms = await prisma.room.findMany();
require('./index'); // loads .env before Prisma reads DATABASE_URL
const { PrismaClient } = require('@prisma/client');

// Password hashes are never returned unless a query asks for them:
//   prisma.guest.findUnique({ where, omit: { passwordHash: false } })
const prisma = new PrismaClient({
  omit: {
    guest: { passwordHash: true },
    staff: { passwordHash: true },
    platformAdmin: { passwordHash: true },
  },
});

module.exports = prisma;

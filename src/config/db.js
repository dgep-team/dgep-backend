// One shared database client for the whole app.
//
//   const prisma = require('../config/db');
//   const rooms = await prisma.room.findMany();
require('./index'); // loads .env before Prisma reads DATABASE_URL
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;

// Hotel onboarding (PRD HS-01, HS-02):
//   1. the platform team creates the hotel (PENDING) and its first manager
//   2. the manager adds rooms and staff
//   3. the platform team sets it ACTIVE: only then can guests book it
const prisma = require('../config/db');
const AppError = require('../utils/AppError');

const STAFF_FIELDS = { id: true, hotelId: true, email: true, firstName: true, lastName: true, role: true, createdAt: true };

// ----- Platform team -----

function createHotel(data) {
  return prisma.hotel.create({ data });
}

function listHotels() {
  return prisma.hotel.findMany({
    include: { _count: { select: { rooms: true, staff: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function setStatus(hotelId, status) {
  if (status === 'ACTIVE') {
    const [rooms, managers] = await Promise.all([
      prisma.room.count({ where: { hotelId } }),
      prisma.staff.count({ where: { hotelId, role: 'MANAGER' } }),
    ]);
    if (!rooms || !managers) {
      throw new AppError(409, 'HOTEL_NOT_READY', 'Add at least one room and one manager before going live', { rooms, managers });
    }
  }
  return prisma.hotel.update({ where: { id: hotelId }, data: { status } }); // unknown id -> 404
}

// ----- Hotel staff -----

async function addStaff(hotelId, data) {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) throw new AppError(404, 'NOT_FOUND', 'Hotel not found');
  return prisma.staff.create({ data: { hotelId, ...data }, select: STAFF_FIELDS }); // email taken -> 409
}

function listStaff(hotelId) {
  return prisma.staff.findMany({ where: { hotelId }, select: STAFF_FIELDS, orderBy: { firstName: 'asc' } });
}

function addRoom(hotelId, data) {
  return prisma.room.create({ data: { hotelId, ...data } }); // number taken in this hotel -> 409
}

module.exports = { createHotel, listHotels, setStatus, addStaff, listStaff, addRoom };

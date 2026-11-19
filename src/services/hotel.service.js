// Hotel onboarding (PRD HS-01, HS-02):
//   1. the platform team creates the hotel (PENDING) and its first manager
//   2. the manager fills in the listing, room types, rooms and staff
//   3. the platform team sets it ACTIVE: only a complete listing can go live
const prisma = require('../config/db');
const AppError = require('../utils/AppError');

const STAFF_FIELDS = { id: true, hotelId: true, email: true, firstName: true, lastName: true, role: true, createdAt: true };

// What a hotel needs before guests can see it (PRD HS-01). Empty list = ready.
async function listingProblems(hotelId) {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    include: { roomTypes: true, _count: { select: { rooms: true, staff: { where: { role: 'MANAGER' } } } } },
  });
  if (!hotel) throw new AppError(404, 'NOT_FOUND', 'Hotel not found');
  const problems = [];
  if (!hotel.description) problems.push('Add a hotel description');
  if (!hotel.photos.length) problems.push('Add at least one hotel photo');
  if (!hotel._count.staff) problems.push('Add a manager');
  if (!hotel._count.rooms) problems.push('Add at least one room');
  for (const t of hotel.roomTypes) {
    if (!t.photos.length) problems.push(`Add a photo for room type "${t.name}"`);
  }
  return problems;
}

// ----- Platform team -----

function createHotel(data) {
  return prisma.hotel.create({ data });
}

function listHotels() {
  return prisma.hotel.findMany({
    include: { _count: { select: { rooms: true, roomTypes: true, staff: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function setStatus(hotelId, status) {
  if (status === 'ACTIVE') {
    const problems = await listingProblems(hotelId);
    if (problems.length) throw new AppError(409, 'HOTEL_NOT_READY', 'The listing is not complete yet', problems);
  }
  return prisma.hotel.update({ where: { id: hotelId }, data: { status } }); // unknown id -> 404
}

// ----- Hotel staff (always their own hotel) -----

async function addStaff(hotelId, data) {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) throw new AppError(404, 'NOT_FOUND', 'Hotel not found');
  return prisma.staff.create({ data: { hotelId, ...data }, select: STAFF_FIELDS }); // email taken -> 409
}

function listStaff(hotelId) {
  return prisma.staff.findMany({ where: { hotelId }, select: STAFF_FIELDS, orderBy: { firstName: 'asc' } });
}

async function getProfile(hotelId) {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  return { ...hotel, listingProblems: await listingProblems(hotelId) };
}

async function updateProfile(hotelId, data) {
  await prisma.hotel.update({ where: { id: hotelId }, data });
  return getProfile(hotelId);
}

function listRoomTypes(hotelId) {
  return prisma.roomType.findMany({
    where: { hotelId },
    include: { rooms: { select: { id: true, number: true }, orderBy: { number: 'asc' } } },
    orderBy: { pricePerNight: 'asc' },
  });
}

function addRoomType(hotelId, data) {
  return prisma.roomType.create({ data: { hotelId, ...data } }); // name taken in this hotel -> 409
}

async function updateRoomType(hotelId, roomTypeId, data) {
  const { count } = await prisma.roomType.updateMany({ where: { id: roomTypeId, hotelId }, data });
  if (!count) throw new AppError(404, 'NOT_FOUND', 'Room type not found');
  return prisma.roomType.findUnique({ where: { id: roomTypeId } });
}

async function addRoom(hotelId, { number, roomTypeId }) {
  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType || roomType.hotelId !== hotelId) throw new AppError(404, 'NOT_FOUND', 'Room type not found');
  return prisma.room.create({ data: { hotelId, roomTypeId, number }, include: { roomType: true } }); // number taken -> 409
}

module.exports = {
  createHotel, listHotels, setStatus,
  addStaff, listStaff, getProfile, updateProfile,
  listRoomTypes, addRoomType, updateRoomType, addRoom,
};

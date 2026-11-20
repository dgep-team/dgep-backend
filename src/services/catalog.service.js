// What guests browse before booking (PRD BR-01 to BR-06). No login needed.
// Only ACTIVE hotels are shown.
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { quote, nightsBetween } = require('../utils/pricing');
const { findBookingForUser } = require('./booking.service');

const STAYING = ['PENDING', 'CONFIRMED', 'CHECKED_IN']; // the same statuses the no-overlap rule blocks
const PUBLIC_HOTEL = { id: true, name: true, city: true, address: true, phone: true, description: true, photos: true, amenities: true, checkInTime: true, checkOutTime: true, taxes: true };

async function listHotels({ city }) {
  const hotels = await prisma.hotel.findMany({
    where: { status: 'ACTIVE', ...(city && { city: { equals: city, mode: 'insensitive' } }) },
    select: { ...PUBLIC_HOTEL, roomTypes: { select: { pricePerNight: true } } },
    orderBy: { name: 'asc' },
  });
  return hotels.map(({ roomTypes, ...hotel }) => ({
    ...hotel,
    fromPricePerNight: roomTypes.length ? Math.min(...roomTypes.map((t) => t.pricePerNight)) : null,
  }));
}

// Each room type, and with dates: how many rooms are free and the all-in price
async function getHotel(hotelId, { checkIn, checkOut, guests }) {
  const hotel = await prisma.hotel.findFirst({
    where: { id: hotelId, status: 'ACTIVE' },
    select: { ...PUBLIC_HOTEL, roomTypes: { include: { rooms: { select: { id: true } } }, orderBy: { pricePerNight: 'asc' } } },
  });
  if (!hotel) throw new AppError(404, 'NOT_FOUND', 'Hotel not found');

  const roomTypes = await Promise.all(hotel.roomTypes.map(async ({ rooms, ...type }) => {
    if (guests && type.maxGuests < guests) return null; // too small
    if (!checkIn) return { ...type, totalRooms: rooms.length };
    const booked = await prisma.booking.count({
      where: { roomId: { in: rooms.map((r) => r.id) }, status: { in: STAYING }, checkIn: { lt: new Date(checkOut) }, checkOut: { gt: new Date(checkIn) } },
    });
    return {
      ...type,
      totalRooms: rooms.length,
      availableRooms: rooms.length - booked,
      price: quote({ pricePerNight: type.pricePerNight, nights: nightsBetween(checkIn, checkOut), taxes: hotel.taxes }),
    };
  }));
  return { ...hotel, roomTypes: roomTypes.filter(Boolean) };
}

// Side by side, up to 3 (PRD BR-04)
async function compareRoomTypes({ ids, checkIn, checkOut }) {
  const types = await prisma.roomType.findMany({
    where: { id: { in: ids }, hotel: { status: 'ACTIVE' } },
    include: { hotel: { select: { id: true, name: true, city: true, taxes: true } } },
  });
  return ids
    .map((typeId) => types.find((t) => t.id === typeId))
    .filter(Boolean)
    .map((t) => ({
      ...t,
      ...(checkIn && { price: quote({ pricePerNight: t.pricePerNight, nights: nightsBetween(checkIn, checkOut), taxes: t.hotel.taxes }) }),
    }));
}

// Arrival instructions for a guest's booking (PRD PC-05)
async function arrivalInfo(bookingId, user) {
  const booking = await findBookingForUser(bookingId, user, {
    room: { include: { hotel: true, roomType: { select: { name: true } } } },
  });
  const { hotel, roomType, number } = booking.room;
  return {
    hotelName: hotel.name,
    address: hotel.address,
    phone: hotel.phone, // for tap-to-call (PRD IS-05)
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    arrivalInstructions: hotel.arrivalInstructions,
    parkingInfo: hotel.parkingInfo,
    roomType: roomType.name,
    roomNumber: booking.status === 'CHECKED_IN' ? number : null, // given at check-in
  };
}

module.exports = { listHotels, getHotel, compareRoomTypes, arrivalInfo };

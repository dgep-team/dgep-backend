// Demo data for local development and the staging demo.
//   npm run db:seed
//
// Safe to run again: every record has a fixed id and is upserted (created or
// refreshed), so nothing is duplicated and nothing else is deleted.
// Booking dates are relative to today, so the dashboard always has
// arrivals, departures and guests in-house.
require('../src/config'); // loads .env
const prisma = require('../src/config/db');
const { hotelToday } = require('../src/utils/dates');
const { quote } = require('../src/utils/pricing');
const { hashPassword } = require('../src/utils/auth');

// Demo logins. Every demo account uses this password.
const DEMO_PASSWORD = 'Password123!';

// Readable fixed ids: ...01xx = hotels, 02xx = staff, 03xx = rooms, 04xx = guests, 05xx = bookings, 06xx = requests, 07xx = room types
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const day = (offset) => new Date(new Date(hotelToday('Africa/Lagos')).getTime() + offset * 86400000);
const naira = (n) => n * 100; // prices are stored in kobo

const photo = (name) => `https://picsum.photos/seed/dgep-${name}/1200/800`; // placeholder images
const NIGERIA_TAXES = [{ name: 'VAT', percent: 7.5 }, { name: 'Service charge', percent: 10 }];

const hotels = [
  {
    id: id(101), name: 'Eko Suites', city: 'Lagos', address: '12 Marina Road, Lagos Island', phone: '+2348010000001', status: 'ACTIVE',
    description: 'A calm business hotel on the Lagos Marina, 10 minutes from Victoria Island.',
    photos: [photo('eko-1'), photo('eko-2')], amenities: ['Free Wi-Fi', 'Pool', 'Gym', 'Restaurant', 'Airport shuttle'],
    arrivalInstructions: 'Enter from Marina Road. Reception is on the ground floor, open 24 hours.',
    parkingInfo: 'Free parking behind the hotel.', taxes: NIGERIA_TAXES,
  },
  {
    id: id(102), name: 'Abuja Grand', city: 'Abuja', address: '5 Aso Drive, Maitama', phone: '+2348010000002', status: 'ACTIVE',
    description: 'Quiet rooms with garden views in Maitama, close to the Central Business District.',
    photos: [photo('abuja-1')], amenities: ['Free Wi-Fi', 'Restaurant', 'Garden'], checkInTime: '15:00', checkOutTime: '11:00',
    arrivalInstructions: 'Show your booking at the gate; security will direct you to reception.',
    parkingInfo: 'Secure parking, ₦2,000 per night.', taxes: NIGERIA_TAXES,
  },
  { id: id(103), name: 'Harbour View', city: 'Port Harcourt', address: '8 Aba Road, GRA', phone: '+2348010000003', status: 'PENDING' }, // still onboarding: no listing yet
];

const roomTypes = [
  {
    id: id(701), hotelId: id(101), name: 'Standard', bedType: '1 queen bed', maxGuests: 2, sizeSqm: 22, view: 'City view',
    pricePerNight: naira(35000), amenities: ['Air conditioning', 'Smart TV', 'Desk'], photos: [photo('eko-standard')],
    description: 'A bright room with everything you need for a short stay.', cancellationPolicy: 'Free cancellation until 24 hours before check-in.',
  },
  {
    id: id(702), hotelId: id(101), name: 'Deluxe King', bedType: '1 king bed', maxGuests: 2, sizeSqm: 30, view: 'Lagoon view',
    pricePerNight: naira(45000), amenities: ['Air conditioning', 'Smart TV', 'Minibar', 'Rain shower'], accessibility: ['Step-free access'],
    photos: [photo('eko-deluxe')], description: 'More space and a view over the lagoon.', cancellationPolicy: 'Free cancellation until 24 hours before check-in.',
  },
  {
    id: id(703), hotelId: id(101), name: 'Executive Suite', bedType: '1 king bed + sofa bed', maxGuests: 4, sizeSqm: 55, view: 'Lagoon view',
    pricePerNight: naira(90000), amenities: ['Living room', 'Bathtub', 'Minibar', 'Lounge access'], photos: [photo('eko-suite')],
    description: 'A separate living room, ideal for families or longer stays.', cancellationPolicy: 'Non-refundable.',
  },
  {
    id: id(704), hotelId: id(102), name: 'Standard', bedType: '1 double bed', maxGuests: 2, sizeSqm: 20, view: 'Garden view',
    pricePerNight: naira(40000), amenities: ['Air conditioning', 'TV'], photos: [photo('abuja-standard')],
    cancellationPolicy: 'Free cancellation until 48 hours before check-in.',
  },
  {
    id: id(705), hotelId: id(102), name: 'Deluxe Twin', bedType: '2 single beds', maxGuests: 2, sizeSqm: 28, view: 'Garden view',
    pricePerNight: naira(55000), amenities: ['Air conditioning', 'TV', 'Kettle'], photos: [photo('abuja-twin')],
    cancellationPolicy: 'Free cancellation until 48 hours before check-in.',
  },
];

const staff = [
  { id: id(201), hotelId: id(101), email: 'manager@ekosuites.test', firstName: 'Ada', lastName: 'Obi', role: 'MANAGER' },
  { id: id(202), hotelId: id(101), email: 'reception@ekosuites.test', firstName: 'Kemi', lastName: 'Bello', role: 'RECEPTION' },
  { id: id(203), hotelId: id(101), email: 'housekeeping@ekosuites.test', firstName: 'Tolu', lastName: 'Ade', role: 'HOUSEKEEPING' },
  { id: id(204), hotelId: id(101), email: 'maintenance@ekosuites.test', firstName: 'Musa', lastName: 'Ibrahim', role: 'MAINTENANCE' },
  { id: id(205), hotelId: id(102), email: 'manager@abujagrand.test', firstName: 'Bayo', lastName: 'Ade', role: 'MANAGER' },
  { id: id(206), hotelId: id(102), email: 'reception@abujagrand.test', firstName: 'Zainab', lastName: 'Umar', role: 'RECEPTION' },
  { id: id(207), hotelId: id(103), email: 'manager@harbourview.test', firstName: 'Ebi', lastName: 'Douglas', role: 'MANAGER' },
];

// [id, room type, number]
const rooms = [[301, 701, '101'], [302, 701, '102'], [303, 702, '201'], [304, 702, '202'], [305, 703, '301'],
  [306, 704, '101'], [307, 704, '102'], [308, 705, '201']].map(([r, t, number]) => {
  const type = roomTypes.find((x) => x.id === id(t));
  return { id: id(r), hotelId: type.hotelId, roomTypeId: type.id, number };
});

const guests = [
  { id: id(401), email: 'john.doe@guest.test', firstName: 'John', lastName: 'Doe', phone: '+2348020000001' },
  { id: id(402), email: 'amina.yusuf@guest.test', firstName: 'Amina', lastName: 'Yusuf', phone: '+2348020000002' },
  { id: id(403), email: 'chidi.okeke@guest.test', firstName: 'Chidi', lastName: 'Okeke', phone: null },
];

// [id, guest, room, check-in offset, check-out offset, status, online check-in done?]
const bookings = [
  [501, 401, 301, -1, 2, 'CHECKED_IN', true], // John: in-house at Eko
  [502, 402, 303, 0, 3, 'CONFIRMED', false], // Amina: arrives today, can pre-check-in
  [503, 403, 305, 5, 7, 'PENDING', false], // Chidi: not paid yet
  [504, 401, 306, -3, 0, 'CHECKED_OUT', true], // John: left Abuja today
  [505, 402, 308, 10, 12, 'CANCELLED', false], // Amina: cancelled
].map(([b, g, r, from, to, status, online]) => {
  const room = rooms.find((x) => x.id === id(r));
  const type = roomTypes.find((x) => x.id === room.roomTypeId);
  const hotel = hotels.find((x) => x.id === room.hotelId);
  return {
    id: id(b), guestId: id(g), roomId: room.id, checkIn: day(from), checkOut: day(to), status,
    totalAmount: quote({ pricePerNight: type.pricePerNight, nights: to - from, taxes: hotel.taxes }).total,
    ...(online && { arrivalTime: '14:00', onlineCheckInAt: day(from - 1) }),
  };
});

const history = (...steps) => steps.map(([status, byId, byRole, extra]) => ({ at: new Date().toISOString(), byId, byRole, status, ...extra }));
const requests = [
  { id: id(601), bookingId: id(501), category: 'TOWELS', note: 'Two extra bath towels', status: 'SUBMITTED',
    history: history(['SUBMITTED', id(401), 'guest']) },
  { id: id(602), bookingId: id(501), category: 'MAINTENANCE', note: 'The AC is very noisy', status: 'IN_PROGRESS', assignedToId: id(204),
    history: history(['SUBMITTED', id(401), 'guest'], [undefined, id(202), 'staff', { assignedToId: id(204) }], ['IN_PROGRESS', id(204), 'staff']) },
  { id: id(603), bookingId: id(501), category: 'ROOM_SERVICE', note: 'Jollof rice and a Chapman', status: 'COMPLETED', assignedToId: id(203),
    history: history(['SUBMITTED', id(401), 'guest'], ['COMPLETED', id(203), 'staff']) },
];

const upsertAll = (model, rows) =>
  Promise.all(rows.map(({ id: rowId, ...data }) => prisma[model].upsert({ where: { id: rowId }, create: { id: rowId, ...data }, update: data })));

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // Order matters: parents before children
  await upsertAll('platformAdmin', [{ id: id(1), email: 'admin@dgep.test', name: 'Platform team', passwordHash }]);
  await upsertAll('hotel', hotels);
  await upsertAll('staff', staff.map((s) => ({ ...s, passwordHash })));
  // Room types are matched by hotel + name, so types made by the room-types
  // migration from older data are filled in instead of duplicated
  const typeIds = {};
  for (const { id: typeId, ...data } of roomTypes) {
    const saved = await prisma.roomType.upsert({
      where: { hotelId_name: { hotelId: data.hotelId, name: data.name } },
      create: { id: typeId, ...data },
      update: data,
    });
    typeIds[typeId] = saved.id;
  }
  await upsertAll('room', rooms.map((r) => ({ ...r, roomTypeId: typeIds[r.roomTypeId] })));
  await upsertAll('guest', guests.map((g) => (g.id === id(403) ? g : { ...g, passwordHash }))); // Chidi booked without an account
  for (const b of bookings) await upsertAll('booking', [b]); // one by one: the no-overlap rule checks each
  await upsertAll('serviceRequest', requests);

  console.log(`Demo data ready. Log in with these emails and the password ${DEMO_PASSWORD}`);
  console.table([
    { who: 'Platform team', login: 'POST /platform/auth/login', email: 'admin@dgep.test' },
    ...staff.map((s) => ({ who: `${s.role} at ${hotels.find((h) => h.id === s.hotelId).name}`, login: 'POST /admin/auth/login', email: s.email })),
    ...guests.filter((g) => g.id !== id(403)).map((g) => ({ who: `Guest ${g.firstName}`, login: 'POST /auth/login', email: g.email })),
  ]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

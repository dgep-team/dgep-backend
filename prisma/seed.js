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

// Readable fixed ids: ...0001xx = hotels, 02xx = staff, 03xx = rooms, 04xx = guests, 05xx = bookings, 06xx = requests
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const day = (offset) => new Date(new Date(hotelToday('Africa/Lagos')).getTime() + offset * 86400000);
const naira = (n) => n * 100; // prices are stored in kobo

const hotels = [
  { id: id(101), name: 'Eko Suites', city: 'Lagos', address: '12 Marina Road, Lagos Island', phone: '+2348010000001', status: 'ACTIVE' },
  { id: id(102), name: 'Abuja Grand', city: 'Abuja', address: '5 Aso Drive, Maitama', phone: '+2348010000002', status: 'ACTIVE' },
  { id: id(103), name: 'Harbour View', city: 'Port Harcourt', address: '8 Aba Road, GRA', phone: '+2348010000003', status: 'PENDING' }, // still onboarding
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

const rooms = [
  { id: id(301), hotelId: id(101), number: '101', type: 'Standard', pricePerNight: naira(35000) },
  { id: id(302), hotelId: id(101), number: '102', type: 'Standard', pricePerNight: naira(35000) },
  { id: id(303), hotelId: id(101), number: '201', type: 'Deluxe King', pricePerNight: naira(45000) },
  { id: id(304), hotelId: id(101), number: '202', type: 'Deluxe King', pricePerNight: naira(45000) },
  { id: id(305), hotelId: id(101), number: '301', type: 'Executive Suite', pricePerNight: naira(90000) },
  { id: id(306), hotelId: id(102), number: '101', type: 'Standard', pricePerNight: naira(40000) },
  { id: id(307), hotelId: id(102), number: '102', type: 'Standard', pricePerNight: naira(40000) },
  { id: id(308), hotelId: id(102), number: '201', type: 'Deluxe Twin', pricePerNight: naira(55000) },
];

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
  const nights = to - from;
  return {
    id: id(b), guestId: id(g), roomId: room.id, checkIn: day(from), checkOut: day(to), status,
    totalAmount: room.pricePerNight * nights,
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
  // Order matters: parents before children
  await upsertAll('hotel', hotels);
  await upsertAll('staff', staff);
  await upsertAll('room', rooms);
  await upsertAll('guest', guests);
  for (const b of bookings) await upsertAll('booking', [b]); // one by one: the no-overlap rule checks each
  await upsertAll('serviceRequest', requests);

  console.log('Demo data ready. Use these ids as X-User-Id in Postman:');
  console.table([
    ...staff.map((s) => ({ who: `${s.role} at ${hotels.find((h) => h.id === s.hotelId).name}`, 'X-User-Role': 'staff', 'X-User-Id': s.id })),
    ...guests.map((g) => ({ who: `Guest ${g.firstName}`, 'X-User-Role': 'guest', 'X-User-Id': g.id })),
    { who: 'Platform team', 'X-User-Role': 'admin', 'X-User-Id': 'any text' },
  ]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

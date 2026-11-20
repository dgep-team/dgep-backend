const request = require('supertest');

jest.mock('../src/config/db', () => ({
  hotel: { findMany: jest.fn(), findFirst: jest.fn() },
  roomType: { findMany: jest.fn() },
  booking: { count: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
}));
const prisma = require('../src/config/db');
const app = require('../src/app');
const { quote, nightsBetween } = require('../src/utils/pricing');

beforeEach(() => jest.resetAllMocks());

describe('All-in price (BR-06)', () => {
  it('adds each tax to room price x nights', () => {
    expect(quote({ pricePerNight: 4500000, nights: 2, taxes: [{ name: 'VAT', percent: 7.5 }, { name: 'Service charge', percent: 10 }] }))
      .toEqual({
        nights: 2, pricePerNight: 4500000, roomTotal: 9000000, addOns: [], subtotal: 9000000,
        taxes: [{ name: 'VAT', percent: 7.5, amount: 675000 }, { name: 'Service charge', percent: 10, amount: 900000 }],
        total: 10575000,
      });
  });

  it('adds add-ons before taxes: per stay, per night, per guest per night', () => {
    const price = quote({
      pricePerNight: 1000, nights: 2, guests: 2, taxes: [{ name: 'VAT', percent: 10 }],
      addOns: [
        { code: 'AIRPORT_PICKUP', name: 'Pickup', price: 500, per: 'STAY' },
        { code: 'PARKING', name: 'Parking', price: 100, per: 'NIGHT' },
        { code: 'BREAKFAST', name: 'Breakfast', price: 50, per: 'GUEST_NIGHT' },
      ],
    });
    expect(price.addOns.map((a) => [a.code, a.quantity, a.amount])).toEqual([['AIRPORT_PICKUP', 1, 500], ['PARKING', 2, 200], ['BREAKFAST', 4, 200]]);
    expect(price).toMatchObject({ roomTotal: 2000, subtotal: 2900, total: 3190 });
  });

  it('counts nights between dates', () => {
    expect(nightsBetween('2026-12-01', '2026-12-04')).toBe(3);
  });
});

describe('GET /hotels', () => {
  it('lists ACTIVE hotels in a city with their lowest price, no login needed', async () => {
    prisma.hotel.findMany.mockResolvedValue([{ id: 'h1', name: 'Eko', roomTypes: [{ pricePerNight: 4500000 }, { pricePerNight: 3500000 }] }]);
    const res = await request(app).get('/api/v1/hotels?city=lagos');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: 'h1', name: 'Eko', fromPricePerNight: 3500000 }]);
    expect(prisma.hotel.findMany.mock.calls[0][0].where).toEqual({ status: 'ACTIVE', city: { equals: 'lagos', mode: 'insensitive' } });
  });
});

describe('GET /hotels/:id', () => {
  const hotel = {
    id: 'h1', taxes: [{ name: 'VAT', percent: 10 }],
    roomTypes: [
      { id: 't1', name: 'Standard', maxGuests: 2, pricePerNight: 1000, rooms: [{ id: 'r1' }, { id: 'r2' }] },
      { id: 't2', name: 'Family', maxGuests: 4, pricePerNight: 2000, rooms: [{ id: 'r3' }] },
    ],
  };

  it('shows free rooms and the all-in price for the dates', async () => {
    prisma.hotel.findFirst.mockResolvedValue(hotel);
    prisma.booking.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const res = await request(app).get('/api/v1/hotels/h1?checkIn=2026-12-01&checkOut=2026-12-03');
    const [standard, family] = res.body.data.roomTypes;
    expect(standard).toMatchObject({ totalRooms: 2, availableRooms: 1, price: { nights: 2, subtotal: 2000, total: 2200 } });
    expect(family).toMatchObject({ totalRooms: 1, availableRooms: 1 });
  });

  it('hides room types too small for the group', async () => {
    prisma.hotel.findFirst.mockResolvedValue(hotel);
    const res = await request(app).get('/api/v1/hotels/h1?guests=3');
    expect(res.body.data.roomTypes.map((t) => t.name)).toEqual(['Family']);
  });

  it('needs both dates', async () => {
    const res = await request(app).get('/api/v1/hotels/h1?checkIn=2026-12-01');
    expect(res.body.error.details[0]).toEqual({ field: 'checkOut', message: 'Send checkIn and checkOut together' });
  });

  it('a hotel that is not ACTIVE is not found', async () => {
    prisma.hotel.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/hotels/h9');
    expect(res.status).toBe(404);
  });
});

describe('GET /room-types/compare', () => {
  it('compares up to 3, in the order asked', async () => {
    prisma.roomType.findMany.mockResolvedValue([
      { id: 'b', pricePerNight: 2000, hotel: { taxes: [] } },
      { id: 'a', pricePerNight: 1000, hotel: { taxes: [] } },
    ]);
    const res = await request(app).get('/api/v1/room-types/compare?ids=a,b&checkIn=2026-12-01&checkOut=2026-12-02');
    expect(res.body.data.map((t) => [t.id, t.price.total])).toEqual([['a', 1000], ['b', 2000]]);
  });

  it('refuses more than 3', async () => {
    const res = await request(app).get('/api/v1/room-types/compare?ids=a,b,c,d');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /bookings/:id/arrival (PC-05)', () => {
  it('gives arrival details, and the room number only after check-in', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1', guestId: 'g1', status: 'CONFIRMED', checkIn: '2026-12-01', checkOut: '2026-12-03',
      room: { number: '204', hotelId: 'h1', roomType: { name: 'Deluxe' }, hotel: { name: 'Eko', phone: '+234', checkInTime: '14:00', parkingInfo: 'Free' } },
    });
    const res = await request(app).get('/api/v1/bookings/b1/arrival').set({ 'X-User-Id': 'g1' });
    expect(res.body.data).toMatchObject({ hotelName: 'Eko', phone: '+234', checkInTime: '14:00', parkingInfo: 'Free', roomType: 'Deluxe', roomNumber: null });
  });
});

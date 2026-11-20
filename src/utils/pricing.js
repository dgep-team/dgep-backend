// The all-in price a guest sees before paying (PRD BR-06). All in kobo.
//   room price x nights
// + add-ons (per stay, per night, or per guest per night)
// = subtotal, then each of the hotel's taxes on top
//
//   quote({ pricePerNight: 4500000, nights: 2, taxes: [{ name: 'VAT', percent: 7.5 }] })
//   -> { nights: 2, pricePerNight: 4500000, roomTotal: 9000000, addOns: [], subtotal: 9000000,
//        taxes: [{ name: 'VAT', percent: 7.5, amount: 675000 }], total: 9675000 }
const QUANTITY = {
  STAY: () => 1,
  NIGHT: ({ nights }) => nights,
  GUEST_NIGHT: ({ nights, guests }) => nights * guests,
};

function quote({ pricePerNight, nights, taxes = [], addOns = [], guests = 1 }) {
  const roomTotal = pricePerNight * nights;
  const addOnLines = addOns.map((a) => {
    const quantity = QUANTITY[a.per]({ nights, guests });
    return { code: a.code, name: a.name, price: a.price, per: a.per, quantity, amount: a.price * quantity };
  });
  const subtotal = roomTotal + addOnLines.reduce((sum, a) => sum + a.amount, 0);
  const taxLines = taxes.map((t) => ({ ...t, amount: Math.round((subtotal * t.percent) / 100) }));
  const total = subtotal + taxLines.reduce((sum, t) => sum + t.amount, 0);
  return { nights, pricePerNight, roomTotal, addOns: addOnLines, subtotal, taxes: taxLines, total };
}

// Nights between two YYYY-MM-DD dates
const nightsBetween = (checkIn, checkOut) => Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);

module.exports = { quote, nightsBetween, ADD_ON_PER: Object.keys(QUANTITY) };

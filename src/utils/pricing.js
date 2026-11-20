// The all-in price a guest sees before paying (PRD BR-06).
// Room price x nights, plus each of the hotel's taxes and fees. All in kobo.
//
//   quote({ pricePerNight: 4500000, nights: 2, taxes: [{ name: 'VAT', percent: 7.5 }] })
//   -> { nights: 2, pricePerNight: 4500000, subtotal: 9000000,
//        taxes: [{ name: 'VAT', percent: 7.5, amount: 675000 }], total: 9675000 }
function quote({ pricePerNight, nights, taxes = [] }) {
  const subtotal = pricePerNight * nights;
  const lines = taxes.map((t) => ({ ...t, amount: Math.round((subtotal * t.percent) / 100) }));
  const total = subtotal + lines.reduce((sum, line) => sum + line.amount, 0);
  return { nights, pricePerNight, subtotal, taxes: lines, total };
}

// Nights between two YYYY-MM-DD dates
const nightsBetween = (checkIn, checkOut) => Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);

module.exports = { quote, nightsBetween };

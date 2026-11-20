// Stay dates are calendar days (YYYY-MM-DD) in the hotel's own time zone.
// The database stores them as midnight UTC, so new Date('2026-12-01') matches.

// The calendar day of a moment at a hotel, e.g. hotelDay(new Date(), 'Africa/Lagos') -> "2026-11-19"
function hotelDay(moment, timezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(moment);
}

// Today's date at a hotel
const hotelToday = (timezone) => hotelDay(new Date(), timezone);

module.exports = { hotelToday, hotelDay };

// Stay dates are calendar days (YYYY-MM-DD) in the hotel's own time zone.
// The database stores them as midnight UTC, so new Date('2026-12-01') matches.

// Today's date at a hotel, e.g. hotelToday('Africa/Lagos') -> "2026-11-19"
function hotelToday(timezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}

module.exports = { hotelToday };

// Stay dates are calendar days (YYYY-MM-DD) in hotel time (Lagos, UTC+1).
// The database stores them as midnight UTC, so new Date('2026-12-01') matches.

// Today's date at the hotel, e.g. "2026-11-19"
function hotelToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}

module.exports = { hotelToday };

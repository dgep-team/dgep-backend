const admin = require('../services/admin.service');
const { sendSuccess } = require('../utils/response');

async function overview(req, res) {
  sendSuccess(res, await admin.overview(req.query));
}

async function listBookings(req, res) {
  sendSuccess(res, await admin.listBookings(req.query));
}

async function getBooking(req, res) {
  sendSuccess(res, await admin.getBooking(req.params.id, req.user));
}

async function listGuests(req, res) {
  sendSuccess(res, await admin.listGuests(req.query));
}

async function checkInAtDesk(req, res) {
  sendSuccess(res, await admin.checkInAtDesk(req.params.id, req.user));
}

async function roomAvailability(req, res) {
  sendSuccess(res, await admin.roomAvailability(req.query));
}

module.exports = { overview, listBookings, getBooking, listGuests, checkInAtDesk, roomAvailability };

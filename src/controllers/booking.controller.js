const bookings = require('../services/booking.service');
const { sendSuccess } = require('../utils/response');

async function create(req, res) {
  sendSuccess(res, await bookings.createBooking(req.user, req.body), 201);
}

async function listMine(req, res) {
  sendSuccess(res, await bookings.listMyBookings(req.user));
}

async function getOne(req, res) {
  sendSuccess(res, await bookings.getMyBooking(req.params.id, req.user));
}

async function cancel(req, res) {
  sendSuccess(res, await bookings.cancelBooking(req.params.id, req.user));
}

module.exports = { create, listMine, getOne, cancel };

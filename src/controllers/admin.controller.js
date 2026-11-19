const hotelService = require('../services/hotel.service');
const admin = require('../services/admin.service');
const { sendSuccess } = require('../utils/response');

// Every function works on req.user's hotel: staff only touch their own hotel.

// ----- Dashboard -----

async function overview(req, res) {
  sendSuccess(res, await admin.overview(req.user, req.query));
}

async function listBookings(req, res) {
  sendSuccess(res, await admin.listBookings(req.user, req.query));
}

async function getBooking(req, res) {
  sendSuccess(res, await admin.getBooking(req.params.id, req.user));
}

async function checkInAtDesk(req, res) {
  sendSuccess(res, await admin.checkInAtDesk(req.params.id, req.user));
}

async function listGuests(req, res) {
  sendSuccess(res, await admin.listGuests(req.user, req.query));
}

async function roomAvailability(req, res) {
  sendSuccess(res, await admin.roomAvailability(req.user, req.query));
}

// ----- Hotel listing, room types, rooms and staff -----

async function getProfile(req, res) {
  sendSuccess(res, await hotelService.getProfile(req.user.hotelId));
}

async function updateProfile(req, res) {
  sendSuccess(res, await hotelService.updateProfile(req.user.hotelId, req.body));
}

async function listRoomTypes(req, res) {
  sendSuccess(res, await hotelService.listRoomTypes(req.user.hotelId));
}

async function addRoomType(req, res) {
  sendSuccess(res, await hotelService.addRoomType(req.user.hotelId, req.body), 201);
}

async function updateRoomType(req, res) {
  sendSuccess(res, await hotelService.updateRoomType(req.user.hotelId, req.params.id, req.body));
}

async function addRoom(req, res) {
  sendSuccess(res, await hotelService.addRoom(req.user.hotelId, req.body), 201);
}

async function listStaff(req, res) {
  sendSuccess(res, await hotelService.listStaff(req.user.hotelId));
}

async function addStaff(req, res) {
  sendSuccess(res, await hotelService.addStaff(req.user.hotelId, req.body), 201);
}

module.exports = {
  overview, listBookings, getBooking, checkInAtDesk, listGuests, roomAvailability,
  getProfile, updateProfile, listRoomTypes, addRoomType, updateRoomType, addRoom, listStaff, addStaff,
};

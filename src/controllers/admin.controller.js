const hotelService = require('../services/hotel.service');
const { sendSuccess } = require('../utils/response');

// Every function uses req.user.hotelId: staff only touch their own hotel.

async function addRoom(req, res) {
  sendSuccess(res, await hotelService.addRoom(req.user.hotelId, req.body), 201);
}

async function listStaff(req, res) {
  sendSuccess(res, await hotelService.listStaff(req.user.hotelId));
}

async function addStaff(req, res) {
  sendSuccess(res, await hotelService.addStaff(req.user.hotelId, req.body), 201);
}

module.exports = { addRoom, listStaff, addStaff };

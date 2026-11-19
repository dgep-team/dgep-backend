const hotelService = require('../services/hotel.service');
const { sendSuccess } = require('../utils/response');

async function createHotel(req, res) {
  sendSuccess(res, await hotelService.createHotel(req.body), 201);
}

async function listHotels(req, res) {
  sendSuccess(res, await hotelService.listHotels());
}

async function setStatus(req, res) {
  sendSuccess(res, await hotelService.setStatus(req.params.id, req.body.status));
}

async function addStaff(req, res) {
  sendSuccess(res, await hotelService.addStaff(req.params.id, req.body), 201);
}

module.exports = { createHotel, listHotels, setStatus, addStaff };

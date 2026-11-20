const catalog = require('../services/catalog.service');
const { sendSuccess } = require('../utils/response');

async function listHotels(req, res) {
  sendSuccess(res, await catalog.listHotels(req.query));
}

async function getHotel(req, res) {
  sendSuccess(res, await catalog.getHotel(req.params.id, req.query));
}

async function compareRoomTypes(req, res) {
  sendSuccess(res, await catalog.compareRoomTypes(req.query));
}

async function arrivalInfo(req, res) {
  sendSuccess(res, await catalog.arrivalInfo(req.params.id, req.user));
}

module.exports = { listHotels, getHotel, compareRoomTypes, arrivalInfo };

const requests = require('../services/request.service');
const { sendSuccess } = require('../utils/response');

// ----- Guest -----

function listCategories(req, res) {
  sendSuccess(res, requests.CATEGORIES);
}

async function createRequest(req, res) {
  sendSuccess(res, await requests.createRequest(req.params.id, req.user, req.body), 201);
}

async function listForBooking(req, res) {
  sendSuccess(res, await requests.listForBooking(req.params.id, req.user));
}

async function getRequest(req, res) {
  sendSuccess(res, await requests.getRequest(req.params.id, req.user));
}

async function cancelRequest(req, res) {
  sendSuccess(res, await requests.cancelRequest(req.params.id, req.user));
}

// ----- Staff -----

async function listForHotel(req, res) {
  sendSuccess(res, await requests.listForHotel(req.user, req.query));
}

async function getForStaff(req, res) {
  sendSuccess(res, await requests.getForStaff(req.params.id, req.user));
}

async function updateStatus(req, res) {
  sendSuccess(res, await requests.updateStatus(req.params.id, req.user, req.body));
}

async function assign(req, res) {
  sendSuccess(res, await requests.assign(req.params.id, req.user, req.body));
}

module.exports = {
  listCategories, createRequest, listForBooking, getRequest, cancelRequest,
  listForHotel, getForStaff, updateStatus, assign,
};

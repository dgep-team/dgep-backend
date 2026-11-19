const concierge = require('../services/concierge.service');
const { sendSuccess } = require('../utils/response');

// ----- Guest -----

function listServices(req, res) {
  sendSuccess(res, concierge.SERVICES);
}

async function createRequest(req, res) {
  sendSuccess(res, await concierge.createRequest(req.params.id, req.user, req.body), 201);
}

async function listForBooking(req, res) {
  sendSuccess(res, await concierge.listForBooking(req.params.id, req.user));
}

async function getRequest(req, res) {
  sendSuccess(res, await concierge.getRequest(req.params.id, req.user));
}

async function cancelRequest(req, res) {
  sendSuccess(res, await concierge.cancelRequest(req.params.id, req.user));
}

// ----- Staff -----

async function listAll(req, res) {
  sendSuccess(res, await concierge.listAll(req.query));
}

async function getForStaff(req, res) {
  sendSuccess(res, await concierge.getForStaff(req.params.id, req.user));
}

async function updateStatus(req, res) {
  sendSuccess(res, await concierge.updateStatus(req.params.id, req.user, req.body));
}

module.exports = { listServices, createRequest, listForBooking, getRequest, cancelRequest, listAll, getForStaff, updateStatus };

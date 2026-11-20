const checkInService = require('../services/checkIn.service');
const { sendSuccess } = require('../utils/response');

async function getCheckIn(req, res) {
  sendSuccess(res, await checkInService.getStatus(req.params.id, req.user));
}

async function completeCheckIn(req, res) {
  sendSuccess(res, await checkInService.completeCheckIn(req.params.id, req.user, req.body));
}

module.exports = { getCheckIn, completeCheckIn };

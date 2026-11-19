const digitalKeyService = require('../services/digitalKey.service');
const { sendSuccess } = require('../utils/response');

async function getKey(req, res) {
  sendSuccess(res, await digitalKeyService.getKey(req.params.id, req.user));
}

async function unlock(req, res) {
  sendSuccess(res, await digitalKeyService.unlock(req.params.id, req.user));
}

module.exports = { getKey, unlock };

const idVerificationService = require('../services/idVerification.service');
const { sendSuccess } = require('../utils/response');

async function submit(req, res) {
  const result = await idVerificationService.submit(req.params.id, req.user, req.body, req.files);
  sendSuccess(res, result, 201);
}

async function getStatus(req, res) {
  sendSuccess(res, await idVerificationService.getStatus(req.params.id, req.user));
}

async function list(req, res) {
  sendSuccess(res, await idVerificationService.list(req.query));
}

async function review(req, res) {
  sendSuccess(res, await idVerificationService.review(req.params.id, req.user, req.body));
}

module.exports = { submit, getStatus, list, review };

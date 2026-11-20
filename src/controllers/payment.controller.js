const payments = require('../services/payment.service');
const { sendSuccess } = require('../utils/response');

async function start(req, res) {
  sendSuccess(res, await payments.startPayment(req.params.id, req.user), 201);
}

async function verify(req, res) {
  sendSuccess(res, await payments.verifyPayment(req.params.reference, req.user));
}

async function webhook(req, res) {
  sendSuccess(res, await payments.handleWebhook(req.rawBody, req.get('x-paystack-signature'), req.body));
}

module.exports = { start, verify, webhook };

// The few Paystack API calls we use. Docs: https://paystack.com/docs/api/transaction
const crypto = require('crypto');
const config = require('../config');
const AppError = require('../utils/AppError');

async function call(path, options = {}) {
  if (!config.paystackSecret) throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Payments are not set up yet');
  const res = await fetch('https://api.paystack.co' + path, {
    ...options,
    headers: { Authorization: `Bearer ${config.paystackSecret}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.status) throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', body.message || 'Paystack did not answer');
  return body.data;
}

// -> { authorization_url, reference }
const initialize = (fields) => call('/transaction/initialize', { method: 'POST', body: JSON.stringify(fields) });

// -> { status: 'success' | 'failed' | 'abandoned' | ..., amount, currency, paid_at, channel }
const verify = (reference) => call(`/transaction/verify/${encodeURIComponent(reference)}`);

// Webhooks are signed with our secret key (HMAC SHA512 of the raw body)
function isValidSignature(rawBody, signature) {
  if (!config.paystackSecret || !rawBody || !signature) return false;
  const expected = crypto.createHmac('sha512', config.paystackSecret).update(rawBody).digest('hex');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

module.exports = { initialize, verify, isValidSignature };

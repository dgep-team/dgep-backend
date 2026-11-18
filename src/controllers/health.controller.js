const { sendSuccess } = require('../utils/response');

function getHealth(req, res) {
  sendSuccess(res, { status: 'ok' });
}

module.exports = { getHealth };

const auth = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');

async function register(req, res) {
  sendSuccess(res, await auth.register(req.body), 201);
}

async function login(req, res) {
  sendSuccess(res, await auth.login(req.body));
}

async function setPassword(req, res) {
  sendSuccess(res, await auth.setPassword(req.user, req.body));
}

async function getMe(req, res) {
  sendSuccess(res, await auth.getMe(req.user));
}

async function updateMe(req, res) {
  sendSuccess(res, await auth.updateMe(req.user, req.body));
}

async function staffLogin(req, res) {
  sendSuccess(res, await auth.staffLogin(req.body));
}

async function adminLogin(req, res) {
  sendSuccess(res, await auth.adminLogin(req.body));
}

module.exports = { register, login, setPassword, getMe, updateMe, staffLogin, adminLogin };

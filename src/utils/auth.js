// Passwords and login tokens.
//   const hash = await hashPassword('secret123');
//   const token = signToken({ id: guest.id, role: 'guest' });
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

const hashPassword = (password) => bcrypt.hash(password, 10);
const checkPassword = (password, hash) => Boolean(hash) && bcrypt.compare(password, hash);

// The token says who you are: { sub: id, role }. Staff tokens also carry hotelId.
const signToken = ({ id, role, hotelId }) =>
  jwt.sign({ role, ...(hotelId && { hotelId }) }, config.jwtSecret, { subject: id, expiresIn: config.jwtExpiresIn });

// Returns { id, role } or null if the token is missing, wrong or expired
function readToken(token) {
  try {
    const { sub, role } = jwt.verify(token, config.jwtSecret);
    return { id: sub, role };
  } catch {
    return null;
  }
}

module.exports = { hashPassword, checkPassword, signToken, readToken };

// All settings from environment variables live here.
// Other files import config instead of reading process.env directly.
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
};

config.isProduction = config.env === 'production';

// Header login for local testing (X-User-Id, X-User-Role), next to real tokens.
// On by default locally; on Render it is off unless AUTH_STUB=true.
config.authStub = process.env.AUTH_STUB
  ? process.env.AUTH_STUB === 'true'
  : !config.isProduction;

// Signs login tokens. Set JWT_SECRET on Render: without it a random secret is
// used, so everyone is logged out whenever the server restarts.
config.jwtSecret = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET && config.isProduction) console.warn('JWT_SECRET is not set: using a temporary secret');
config.jwtExpiresIn = '7d';

module.exports = config;

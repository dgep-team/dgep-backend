// All settings from environment variables live here.
// Other files import config instead of reading process.env directly.
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
};

config.isProduction = config.env === 'production';

// Temporary login (src/middleware/auth.js) until SCRUM-27 adds real login.
// On by default locally; on Render it is off unless AUTH_STUB=true.
config.authStub = process.env.AUTH_STUB
  ? process.env.AUTH_STUB === 'true'
  : !config.isProduction;

module.exports = config;

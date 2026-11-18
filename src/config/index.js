// All settings from environment variables live here.
// Other files import config instead of reading process.env directly.
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
};

config.isProduction = config.env === 'production';

module.exports = config;

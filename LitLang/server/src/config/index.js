const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'litlang',
    user: process.env.DB_USER || 'litlang_user',
    password: process.env.DB_PASSWORD || 'litlang_pass',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  ai: {
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openRouterModel: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
    hfApiKey: process.env.HF_API_KEY || '',
    hfModel: process.env.HF_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
  },

  openLibrary: {
    baseUrl: process.env.OPEN_LIBRARY_BASE_URL || 'https://openlibrary.org',
  },
};

module.exports = config;

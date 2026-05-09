const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const config = require('./config');
const logger = require('./utils/logger');
const locale = require('./middleware/locale');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Trust nginx reverse proxy
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Locale detection
app.use(locale);

// HTTP logging
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

// Rate limiting on auth endpoints
const authLimiter = rateLimit({
  windowMs: 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' } },
});
app.use('/api/v1/auth', authLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Resource not found' },
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;

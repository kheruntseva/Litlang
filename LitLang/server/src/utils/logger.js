const pino = require('pino');
const config = require('../config');

let transport;
try {
  require.resolve('pino-pretty');
  if (config.env !== 'production') {
    transport = { target: 'pino-pretty', options: { colorize: true } };
  }
} catch (_) {
  // pino-pretty not installed (production build), use default JSON output
}

const logger = pino({
  level: config.env === 'production' ? 'info' : 'debug',
  transport,
});

module.exports = logger;

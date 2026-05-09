const config = require('./config');
const logger = require('./utils/logger');

const app = require('./app');

const port = config.port;

app.listen(port, () => {
  logger.info(`LitLang API server running on port ${port} [${config.env}]`);
});

const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'litlang',
  user: process.env.DB_USER || 'litlang_user',
  password: process.env.DB_PASSWORD || 'litlang_pass',
};

module.exports = {
  development: {
    client: 'pg',
    connection,
    migrations: {
      directory: path.resolve(__dirname, 'src/db/migrations'),
    },
    seeds: {
      directory: path.resolve(__dirname, 'src/db/seeds'),
    },
    pool: { min: 2, max: 10 },
  },

  production: {
    client: 'pg',
    connection,
    migrations: {
      directory: path.resolve(__dirname, 'src/db/migrations'),
    },
    seeds: {
      directory: path.resolve(__dirname, 'src/db/seeds'),
    },
    pool: { min: 2, max: 20 },
  },

  test: {
    client: 'pg',
    connection: {
      ...connection,
      database: `${connection.database}_test`,
    },
    migrations: {
      directory: path.resolve(__dirname, 'src/db/migrations'),
    },
    seeds: {
      directory: path.resolve(__dirname, 'src/db/seeds'),
    },
    pool: { min: 1, max: 5 },
  },
};

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const config = require('../config');
const { UnauthorizedError, ConflictError, NotFoundError } = require('../utils/errors');

const SALT_ROUNDS = 12;

/**
 * Generate an access token for a user.
 * @param {object} user - { id, email, role }
 * @returns {string}
 */
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/**
 * Generate a refresh token for a user.
 * @param {object} user - { id }
 * @returns {string}
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

/**
 * Register a new user.
 * @param {object} data - { email, password, display_name }
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
async function register({ email, password, display_name }) {
  const existing = await db('users').where({ email }).first();
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await db.transaction(async (trx) => {
    const [newUser] = await trx('users')
      .insert({ email, password_hash, display_name })
      .returning(['id', 'email', 'display_name', 'role', 'preferred_locale']);

    // Seed not_started progress for every existing rule
    const rules = await trx('rules').select('id');
    if (rules.length > 0) {
      await trx('user_progress').insert(
        rules.map((r) => ({
          user_id: newUser.id,
          rule_id: r.id,
          status: 'not_started',
        }))
      );
    }

    return newUser;
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return { user, accessToken, refreshToken };
}

/**
 * Login with email and password.
 * @param {object} data - { email, password }
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
async function login({ email, password }) {
  const user = await db('users')
    .where({ email, is_active: true })
    .first();

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const safeUser = {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    preferred_locale: user.preferred_locale,
  };

  return { user: safeUser, accessToken, refreshToken };
}

/**
 * Refresh tokens using a valid refresh token.
 * @param {string} token - The refresh token
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
async function refresh(token) {
  if (!token) {
    throw new UnauthorizedError('Refresh token required');
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (payload.type !== 'refresh') {
    throw new UnauthorizedError('Invalid token type');
  }

  const user = await db('users')
    .where({ id: payload.id, is_active: true })
    .first();

  if (!user) {
    throw new NotFoundError('User');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const safeUser = {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    preferred_locale: user.preferred_locale,
  };

  return { user: safeUser, accessToken, refreshToken };
}

module.exports = { register, login, refresh };

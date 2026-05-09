const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authService = require('../services/authService');
const config = require('../config');

const router = Router();

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth',
};

// POST /api/v1/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('display_name').trim().isLength({ min: 1, max: 100 }).withMessage('Display name required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { user, accessToken, refreshToken } = await authService.register(req.body);
      res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(201).json({ data: { user, accessToken } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { user, accessToken, refreshToken } = await authService.login(req.body);
      res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
      res.json({ data: { user, accessToken } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    const { user, accessToken, refreshToken } = await authService.refresh(token);
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ data: { user, accessToken } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  res.json({ data: { message: 'Logged out' } });
});

module.exports = router;

const { Router } = require('express');
const authRoutes = require('./auth');
const languageRoutes = require('./languages');
const categoryRoutes = require('./categories');
const ruleRoutes = require('./rules');
const excerptRoutes = require('./excerpts');
const bookRoutes = require('./books');
const searchRoutes = require('./search');
const userRoutes = require('./user');
const adminRoutes = require('./admin');

const router = Router();

// Auth
router.use('/auth', authRoutes);

// Public content routes
router.use('/languages', languageRoutes);
router.use('/categories', categoryRoutes);
router.use('/rules', ruleRoutes);
router.use('/excerpts', excerptRoutes);
router.use('/books', bookRoutes);
router.use('/search', searchRoutes);

// User routes
router.use('/me', userRoutes);

// Admin routes
router.use('/admin', adminRoutes);

module.exports = router;

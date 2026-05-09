const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const usersRoutes = require('./users');
const contentRoutes = require('./content');
const analyticsRoutes = require('./analytics');
const aiRoutes = require('./ai');
const gutenbergRoutes = require('./gutenberg');

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

router.use('/users', usersRoutes);
router.use('/', contentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/ai', aiRoutes);
router.use('/gutenberg', gutenbergRoutes);

module.exports = router;

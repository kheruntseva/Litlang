const { Router } = require('express');
const analyticsService = require('../../services/analyticsService');

const router = Router();

// GET /api/v1/admin/analytics
router.get('/', async (_req, res, next) => {
  try {
    const dashboard = await analyticsService.getDashboard();
    res.json({ data: dashboard });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

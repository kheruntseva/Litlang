const { Router } = require('express');
const { param, query } = require('express-validator');
const validate = require('../middleware/validate');
const contentService = require('../services/contentService');

const router = Router();

// GET /api/v1/categories/:id/rules
router.get(
  '/:id/rules',
  [
    param('id').isInt().withMessage('Category ID must be an integer'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await contentService.getRulesByCategory(
        parseInt(req.params.id, 10),
        req.locale,
        { page: req.query.page, limit: req.query.limit }
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

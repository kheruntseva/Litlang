const { Router } = require('express');
const { param, query } = require('express-validator');
const validate = require('../middleware/validate');
const contentService = require('../services/contentService');

const router = Router();

// GET /api/v1/rules/:id
router.get(
  '/:id',
  [param('id').isInt().withMessage('Rule ID must be an integer')],
  validate,
  async (req, res, next) => {
    try {
      const rule = await contentService.getRuleById(
        parseInt(req.params.id, 10),
        req.locale
      );
      res.json({ data: rule });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/rules/:id/excerpts
router.get(
  '/:id/excerpts',
  [
    param('id').isInt().withMessage('Rule ID must be an integer'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await contentService.getExcerptsByRule(
        parseInt(req.params.id, 10),
        { page: req.query.page, limit: req.query.limit }
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

const { Router } = require('express');
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const contentService = require('../services/contentService');

const router = Router();

// GET /api/v1/search?q=...
router.get(
  '/',
  [
    query('q').trim().isLength({ min: 1 }).withMessage('Search query required'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await contentService.searchExcerpts(req.query.q, {
        page: req.query.page,
        limit: req.query.limit,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

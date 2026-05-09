const { Router } = require('express');
const { param, query } = require('express-validator');
const validate = require('../middleware/validate');
const contentService = require('../services/contentService');

const router = Router();

// GET /api/v1/books
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await contentService.getBooks({
        page: req.query.page,
        limit: req.query.limit,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/books/:id
router.get(
  '/:id',
  [param('id').isInt().withMessage('Book ID must be an integer')],
  validate,
  async (req, res, next) => {
    try {
      const book = await contentService.getBookById(parseInt(req.params.id, 10));
      res.json({ data: book });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/books/:id/excerpts
router.get(
  '/:id/excerpts',
  [
    param('id').isInt().withMessage('Book ID must be an integer'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('rule_id').optional().isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await contentService.getExcerptsByBook(
        parseInt(req.params.id, 10),
        { page: req.query.page, limit: req.query.limit },
        req.query.rule_id ? parseInt(req.query.rule_id, 10) : undefined
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

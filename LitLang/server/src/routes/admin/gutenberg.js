const { Router } = require('express');
const { query, body } = require('express-validator');
const validate = require('../../middleware/validate');
const gutenbergService = require('../../services/gutenbergService');
const db = require('../../db/connection');

const router = Router();

// GET /api/v1/admin/gutenberg/imported-books
router.get(
  '/imported-books',
  async (req, res, next) => {
    try {
      const books = await db('books as b')
        .join('gutenberg_texts as gt', 'gt.book_id', 'b.id')
        .whereNotNull('b.gutenberg_id')
        .select('b.*')
        .orderBy('b.created_at', 'desc');
      res.json({ data: books });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/admin/gutenberg/search?q=...
router.get(
  '/search',
  [query('q').trim().isLength({ min: 1 }).withMessage('Search query required')],
  validate,
  async (req, res, next) => {
    try {
      const results = await gutenbergService.search(req.query.q);
      res.json({ data: results });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/admin/gutenberg/import
router.post(
  '/import',
  [
    body('gutenberg_id').isInt().withMessage('gutenberg_id required'),
    body('title').optional().isString(),
    body('author').optional().isString(),
    body('language').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const book = await gutenbergService.importText(req.body.gutenberg_id, {
        title: req.body.title,
        author: req.body.author,
        language: req.body.language,
      });
      res.status(201).json({ data: book });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/admin/gutenberg/extract
router.post(
  '/extract',
  [
    body('book_id').isInt().withMessage('book_id required'),
    body('rule_id').isInt().withMessage('rule_id required'),
    body('pattern').optional().isString(),
    body('count').optional().isInt({ min: 1, max: 20 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await gutenbergService.listBookSnippetsForRule(
        req.body.book_id,
        req.body.rule_id,
        req.body.pattern,
        { page: 1, limit: req.body.count || 10, locale: req.locale || 'en' }
      );
      res.json({ data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

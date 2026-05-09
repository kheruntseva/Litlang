const { Router } = require('express');
const { body, param, query } = require('express-validator');
const bcrypt = require('bcrypt');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const db = require('../db/connection');
const progressService = require('../services/progressService');
const favouriteService = require('../services/favouriteService');
const gutenbergService = require('../services/gutenbergService');
const { NotFoundError } = require('../utils/errors');

const router = Router();

// All /me routes require authentication
router.use(authenticate);

// GET /api/v1/me
router.get('/', async (req, res, next) => {
  try {
    const user = await db('users')
      .where({ id: req.user.id })
      .select('id', 'email', 'display_name', 'role', 'preferred_locale', 'created_at')
      .first();
    if (!user) throw new NotFoundError('User');
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/me
router.patch(
  '/',
  [
    body('display_name').optional().trim().isLength({ min: 1, max: 100 }),
    body('password').optional().isLength({ min: 6 }),
    body('preferred_locale').optional().isIn(['en', 'ru']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const updates = {};
      if (req.body.display_name) updates.display_name = req.body.display_name;
      if (req.body.preferred_locale) updates.preferred_locale = req.body.preferred_locale;
      if (req.body.password) {
        updates.password_hash = await bcrypt.hash(req.body.password, 12);
      }
      updates.updated_at = db.fn.now();

      const [user] = await db('users')
        .where({ id: req.user.id })
        .update(updates)
        .returning(['id', 'email', 'display_name', 'role', 'preferred_locale']);

      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/me/progress
router.get(
  '/progress',
  [
    query('status').optional().isIn(['not_started', 'in_progress', 'completed']),
    query('language_id').optional().isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const progress = await progressService.getUserProgress(req.user.id, {
        status: req.query.status,
        language_id: req.query.language_id,
      });
      res.json({ data: progress });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/me/progress/:ruleId
router.put(
  '/progress/:ruleId',
  [
    param('ruleId').isInt().withMessage('Rule ID must be an integer'),
    body('status').isIn(['not_started', 'in_progress', 'completed']).withMessage('Invalid status'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const progress = await progressService.setProgress(
        req.user.id,
        parseInt(req.params.ruleId, 10),
        req.body.status
      );
      res.json({ data: progress });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/me/favourites
router.get(
  '/favourites',
  [query('target_type').optional().isIn(['rule', 'excerpt', 'book', 'gutenberg_snippet'])],
  validate,
  async (req, res, next) => {
    try {
      const favourites = await favouriteService.getUserFavourites(req.user.id, {
        target_type: req.query.target_type,
      });
      res.json({ data: favourites });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/me/favourites
router.post(
  '/favourites',
  [
    body('target_type').isIn(['rule', 'excerpt', 'book', 'gutenberg_snippet']).withMessage('target_type must be rule, excerpt, book or gutenberg_snippet'),
    body('target_id').isInt().withMessage('target_id must be an integer'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const favourite = await favouriteService.addFavourite(
        req.user.id,
        req.body.target_type,
        parseInt(String(req.body.target_id), 10)
      );
      res.status(201).json({ data: favourite });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/me/gutenberg/books/:bookId/snippets?page=1&limit=5
router.get(
  '/gutenberg/books/:bookId/snippets',
  [
    param('bookId').isInt().withMessage('bookId must be integer'),
    query('rule_id').optional().isInt({ min: 1 }),
    query('pattern').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 20 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const bookId = parseInt(req.params.bookId, 10);
      let result;
      if (req.query.rule_id) {
        result = await gutenbergService.listBookSnippetsForRule(
          bookId,
          parseInt(String(req.query.rule_id), 10),
          req.query.pattern,
          { page: req.query.page, limit: req.query.limit || 5, locale: req.locale || 'en' }
        );
      } else {
        result = await gutenbergService.listBookSnippets(
          bookId,
          { page: req.query.page, limit: req.query.limit || 5 }
        );
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/me/gutenberg/snippets/favourite
router.post(
  '/gutenberg/snippets/favourite',
  [
    body('book_id').isInt().withMessage('book_id required'),
    body('passage').isString().trim().isLength({ min: 10 }).withMessage('passage required'),
    body('highlight').optional({ nullable: true }).isString(),
    body('page_number').optional({ nullable: true }).isString(),
    body('chapter').optional({ nullable: true }).isString(),
    body('context_note').optional({ nullable: true }).isString(),
    body('rule_id').optional({ nullable: true }).isInt(),
    body('paragraph_number').optional({ nullable: true }).isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const payload = {
        user_id: req.user.id,
        book_id: parseInt(String(req.body.book_id), 10),
        passage: String(req.body.passage).trim(),
        highlight: req.body.highlight ? String(req.body.highlight) : null,
        page_number: req.body.page_number ? String(req.body.page_number) : null,
        chapter: req.body.chapter ? String(req.body.chapter) : null,
        context_note: req.body.context_note ? String(req.body.context_note) : null,
        rule_id: req.body.rule_id ? parseInt(String(req.body.rule_id), 10) : null,
        paragraph_number: req.body.paragraph_number ? parseInt(String(req.body.paragraph_number), 10) : null,
      };

      let snippet = await db('gutenberg_user_snippets')
        .where({ user_id: payload.user_id, book_id: payload.book_id, passage: payload.passage })
        .first();

      if (!snippet) {
        [snippet] = await db('gutenberg_user_snippets')
          .insert(payload)
          .returning('*');
      }

      const favourite = await favouriteService.addFavourite(req.user.id, 'gutenberg_snippet', snippet.id);
      res.status(201).json({ data: { favourite, snippet } });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/me/favourites/:id
router.delete(
  '/favourites/:id',
  [param('id').isInt().withMessage('Favourite ID must be an integer')],
  validate,
  async (req, res, next) => {
    try {
      await favouriteService.removeFavourite(req.user.id, parseInt(req.params.id, 10));
      res.json({ data: { message: 'Favourite removed' } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/me/stats
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await progressService.getStats(req.user.id);
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/me/gutenberg/search?q=...
router.get(
  '/gutenberg/search',
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

// POST /api/v1/me/gutenberg/import
router.post(
  '/gutenberg/import',
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

module.exports = router;

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../../middleware/validate');
const db = require('../../db/connection');
const { NotFoundError } = require('../../utils/errors');

const router = Router();

// ── Languages ──

// POST /api/v1/admin/languages
router.post(
  '/languages',
  [
    body('code').trim().isLength({ min: 2, max: 10 }).withMessage('Language code required'),
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Language name required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const [language] = await db('languages')
        .insert({ code: req.body.code, name: req.body.name })
        .returning('*');
      res.status(201).json({ data: language });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/admin/languages/:id
router.put(
  '/languages/:id',
  [
    param('id').isInt(),
    body('code').optional().trim().isLength({ min: 2, max: 10 }),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const updates = {};
      if (req.body.code) updates.code = req.body.code;
      if (req.body.name) updates.name = req.body.name;

      const [language] = await db('languages')
        .where({ id: req.params.id })
        .update(updates)
        .returning('*');

      if (!language) throw new NotFoundError('Language');
      res.json({ data: language });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/admin/languages/:id
router.delete(
  '/languages/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const deleted = await db('languages').where({ id: req.params.id }).del();
      if (!deleted) throw new NotFoundError('Language');
      res.json({ data: { message: 'Language deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// ── Categories ──

// POST /api/v1/admin/categories
router.post(
  '/categories',
  [
    body('language_id').isInt().withMessage('language_id required'),
    body('slug').trim().isLength({ min: 1, max: 200 }).withMessage('slug required'),
    body('sort_order').optional().isInt(),
    body('translations').isArray({ min: 1 }).withMessage('At least one translation required'),
    body('translations.*.locale').isString().isLength({ min: 2, max: 10 }),
    body('translations.*.title').isString().isLength({ min: 1, max: 200 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await db.transaction(async (trx) => {
        const [category] = await trx('categories')
          .insert({
            language_id: req.body.language_id,
            slug: req.body.slug,
            sort_order: req.body.sort_order || 0,
          })
          .returning('*');

        const translations = req.body.translations.map((t) => ({
          category_id: category.id,
          locale: t.locale,
          title: t.title,
        }));
        await trx('category_translations').insert(translations);

        return category;
      });

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/admin/categories/:id
router.put(
  '/categories/:id',
  [
    param('id').isInt(),
    body('slug').optional().trim().isLength({ min: 1, max: 200 }),
    body('sort_order').optional().isInt(),
    body('translations').optional().isArray(),
    body('translations.*.locale').optional().isString(),
    body('translations.*.title').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await db.transaction(async (trx) => {
        const updates = {};
        if (req.body.slug) updates.slug = req.body.slug;
        if (req.body.sort_order !== undefined) updates.sort_order = req.body.sort_order;

        if (Object.keys(updates).length > 0) {
          await trx('categories').where({ id: req.params.id }).update(updates);
        }

        if (req.body.translations) {
          for (const t of req.body.translations) {
            await trx('category_translations')
              .insert({ category_id: req.params.id, locale: t.locale, title: t.title })
              .onConflict(['category_id', 'locale'])
              .merge({ title: t.title });
          }
        }

        return trx('categories').where({ id: req.params.id }).first();
      });

      if (!result) throw new NotFoundError('Category');
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/admin/categories/:id
router.delete(
  '/categories/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const deleted = await db('categories').where({ id: req.params.id }).del();
      if (!deleted) throw new NotFoundError('Category');
      res.json({ data: { message: 'Category deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// ── Rules ──

// POST /api/v1/admin/rules
router.post(
  '/rules',
  [
    body('category_id').isInt().withMessage('category_id required'),
    body('slug').trim().isLength({ min: 1, max: 300 }).withMessage('slug required'),
    body('sort_order').optional().isInt(),
    body('translations').isArray({ min: 1 }).withMessage('At least one translation required'),
    body('translations.*.locale').isString().isLength({ min: 2, max: 10 }),
    body('translations.*.title').isString().isLength({ min: 1, max: 300 }),
    body('translations.*.summary').isString().isLength({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await db.transaction(async (trx) => {
        const [rule] = await trx('rules')
          .insert({
            category_id: req.body.category_id,
            slug: req.body.slug,
            sort_order: req.body.sort_order || 0,
          })
          .returning('*');

        const translations = req.body.translations.map((t) => ({
          rule_id: rule.id,
          locale: t.locale,
          title: t.title,
          summary: t.summary,
        }));
        await trx('rule_translations').insert(translations);

        // Seed not_started progress for all active users
        const users = await trx('users').where('is_active', true).select('id');
        if (users.length > 0) {
          await trx('user_progress').insert(
            users.map((u) => ({
              user_id: u.id,
              rule_id: rule.id,
              status: 'not_started',
            }))
          ).onConflict(['user_id', 'rule_id']).ignore();
        }

        return rule;
      });

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/admin/rules/:id
router.put(
  '/rules/:id',
  [
    param('id').isInt(),
    body('slug').optional().trim().isLength({ min: 1, max: 300 }),
    body('sort_order').optional().isInt(),
    body('translations').optional().isArray(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await db.transaction(async (trx) => {
        const updates = { updated_at: db.fn.now() };
        if (req.body.slug) updates.slug = req.body.slug;
        if (req.body.sort_order !== undefined) updates.sort_order = req.body.sort_order;

        await trx('rules').where({ id: req.params.id }).update(updates);

        if (req.body.translations) {
          for (const t of req.body.translations) {
            await trx('rule_translations')
              .insert({ rule_id: req.params.id, locale: t.locale, title: t.title, summary: t.summary })
              .onConflict(['rule_id', 'locale'])
              .merge({ title: t.title, summary: t.summary });
          }
        }

        return trx('rules').where({ id: req.params.id }).first();
      });

      if (!result) throw new NotFoundError('Rule');
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/admin/rules/:id
router.delete(
  '/rules/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const deleted = await db('rules').where({ id: req.params.id }).del();
      if (!deleted) throw new NotFoundError('Rule');
      res.json({ data: { message: 'Rule deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// ── Books ──

// POST /api/v1/admin/books
router.post(
  '/books',
  [
    body('title').trim().isLength({ min: 1, max: 500 }).withMessage('Title required'),
    body('author').trim().isLength({ min: 1, max: 300 }).withMessage('Author required'),
    body('isbn').optional({ nullable: true }).trim(),
    body('language_id').optional().isInt(),
    body('cover_url').optional({ nullable: true }).trim(),
    body('gutenberg_id').optional({ nullable: true }).isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const [book] = await db('books')
        .insert({
          title: req.body.title,
          author: req.body.author,
          isbn: req.body.isbn || null,
          language_id: req.body.language_id || null,
          cover_url: req.body.cover_url || null,
          gutenberg_id: req.body.gutenberg_id || null,
        })
        .returning('*');
      res.status(201).json({ data: book });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/admin/books/:id
router.put(
  '/books/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const updates = {};
      const fields = ['title', 'author', 'isbn', 'language_id', 'cover_url', 'gutenberg_id'];
      for (const field of fields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      const [book] = await db('books')
        .where({ id: req.params.id })
        .update(updates)
        .returning('*');

      if (!book) throw new NotFoundError('Book');
      res.json({ data: book });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/admin/books/:id
router.delete(
  '/books/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const deleted = await db('books').where({ id: req.params.id }).del();
      if (!deleted) throw new NotFoundError('Book');
      res.json({ data: { message: 'Book deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// ── Excerpts ──

// POST /api/v1/admin/excerpts
router.post(
  '/excerpts',
  [
    body('rule_id').isInt().withMessage('rule_id required'),
    body('book_id').isInt().withMessage('book_id required'),
    body('passage').trim().isLength({ min: 1 }).withMessage('passage required'),
    body('highlight').optional({ nullable: true }).trim(),
    body('page_number').optional({ nullable: true }).trim(),
    body('chapter').optional({ nullable: true }).trim(),
    body('context_note').optional({ nullable: true }).trim(),
    body('sort_order').optional().isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const [excerpt] = await db('excerpts')
        .insert({
          rule_id: req.body.rule_id,
          book_id: req.body.book_id,
          passage: req.body.passage,
          highlight: req.body.highlight || null,
          page_number: req.body.page_number || null,
          chapter: req.body.chapter || null,
          context_note: req.body.context_note || null,
          sort_order: req.body.sort_order || 0,
        })
        .returning('*');
      res.status(201).json({ data: excerpt });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/admin/excerpts/:id
router.put(
  '/excerpts/:id',
  [
    param('id').isInt(),
    body('rule_id').optional().isInt(),
    body('book_id').optional().isInt(),
    body('passage').optional().trim().isLength({ min: 1 }),
    body('highlight').optional({ nullable: true }).trim(),
    body('page_number').optional({ nullable: true }).trim(),
    body('chapter').optional({ nullable: true }).trim(),
    body('context_note').optional({ nullable: true }).trim(),
    body('sort_order').optional().isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const updates = {};
      const fields = ['rule_id', 'book_id', 'passage', 'highlight', 'page_number', 'chapter', 'context_note', 'sort_order'];
      for (const field of fields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      if (updates.rule_id !== undefined) updates.rule_id = parseInt(String(updates.rule_id), 10);
      if (updates.book_id !== undefined) updates.book_id = parseInt(String(updates.book_id), 10);
      if (updates.sort_order !== undefined) updates.sort_order = parseInt(String(updates.sort_order), 10);

      const [excerpt] = await db('excerpts')
        .where({ id: req.params.id })
        .update(updates)
        .returning('*');

      if (!excerpt) throw new NotFoundError('Excerpt');
      res.json({ data: excerpt });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/admin/excerpts/:id
router.delete(
  '/excerpts/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const deleted = await db('excerpts').where({ id: req.params.id }).del();
      if (!deleted) throw new NotFoundError('Excerpt');
      res.json({ data: { message: 'Excerpt deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// ── Book ISBN Lookup ──

// GET /api/v1/admin/books/lookup?isbn=...
router.get(
  '/books/lookup',
  [query('isbn').trim().isLength({ min: 1 }).withMessage('ISBN required')],
  validate,
  async (req, res, next) => {
    try {
      const openLibraryService = require('../../services/openLibraryService');
      const bookData = await openLibraryService.lookupByIsbn(req.query.isbn);
      res.json({ data: bookData });
    } catch (err) {
      next(err);
    }
  }
);

// ── Bulk Import ──

// POST /api/v1/admin/import
router.post('/import', async (req, res, next) => {
  try {
    const { languages, categories, rules, books, excerpts } = req.body;

    await db.transaction(async (trx) => {
      if (languages?.length) await trx('languages').insert(languages).onConflict('code').ignore();
      if (categories?.length) await trx('categories').insert(categories);
      if (rules?.length) await trx('rules').insert(rules);
      if (books?.length) await trx('books').insert(books);
      if (excerpts?.length) await trx('excerpts').insert(excerpts);
    });

    res.status(201).json({ data: { message: 'Import completed' } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

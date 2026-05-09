const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const aiService = require('../../services/aiService');
const db = require('../../db/connection');
const { NotFoundError } = require('../../utils/errors');

const router = Router();

// POST /api/v1/admin/ai/suggest-excerpts
router.post(
  '/suggest-excerpts',
  [
    body('rule_id').isInt().withMessage('rule_id required'),
    body('count').optional().isInt({ min: 1, max: 10 }).withMessage('count must be 1-10'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const ruleId = req.body.rule_id;
      const count = req.body.count || 5;

      // Fetch rule with translation
      const rule = await db('rules as r')
        .join('rule_translations as rt', function () {
          this.on('rt.rule_id', 'r.id').andOn('rt.locale', db.raw('?', ['en']));
        })
        .where('r.id', ruleId)
        .select('rt.title', 'rt.summary')
        .first();

      if (!rule) throw new NotFoundError('Rule');

      const suggestions = await aiService.suggestExcerpts(rule, count);
      res.json({ data: suggestions });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/admin/ai/suggest-summary
router.post(
  '/suggest-summary',
  [body('rule_id').isInt().withMessage('rule_id required')],
  validate,
  async (req, res, next) => {
    try {
      const rule = await db('rules as r')
        .join('rule_translations as rt', function () {
          this.on('rt.rule_id', 'r.id').andOn('rt.locale', db.raw('?', ['en']));
        })
        .where('r.id', req.body.rule_id)
        .select('rt.title')
        .first();

      if (!rule) throw new NotFoundError('Rule');

      const summary = await aiService.suggestSummary(rule);
      res.json({ data: { summary } });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

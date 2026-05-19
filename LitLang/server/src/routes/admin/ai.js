const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const aiService = require('../../services/aiService');
const db = require('../../db/connection');
const { NotFoundError } = require('../../utils/errors');

const router = Router();

/**
 * Pick rule/category translation row: preferred course locale, then en, then any.
 * @param {Array<{ locale: string, title?: string, summary?: string }>} rows
 * @param {string} preferredLocale
 */
function pickTranslationRow(rows, preferredLocale) {
  const pref = String(preferredLocale || 'en').toLowerCase().slice(0, 10);
  const loc = (r) => String(r?.locale || '').toLowerCase().slice(0, 10);
  const nonempty = (r) => String(r?.title || '').trim() || String(r?.summary || '').trim();
  return (
    rows.find((r) => loc(r) === pref && nonempty(r))
    || rows.find((r) => loc(r) === 'en' && nonempty(r))
    || rows.find((r) => nonempty(r))
    || rows[0]
    || null
  );
}

/**
 * Load rule + category labels for the course language, and the language in which literary excerpts must be written.
 * @param {number} ruleId
 */
async function loadRuleForAdminAi(ruleId) {
  const base = await db('rules as r')
    .join('categories as c', 'c.id', 'r.category_id')
    .join('languages as l', 'l.id', 'c.language_id')
    .where('r.id', ruleId)
    .select(
      'r.id as rule_id',
      'c.id as category_id',
      'l.code as course_language_code',
      'l.name as course_language_name'
    )
    .first();
  if (!base) return null;

  const courseLocale = String(base.course_language_code || 'en').toLowerCase().slice(0, 10);

  const rtRows = await db('rule_translations')
    .where({ rule_id: ruleId })
    .select('locale', 'title', 'summary');
  if (!rtRows.length) return null;

  const primary = pickTranslationRow(rtRows, courseLocale);
  if (!primary) return null;

  const catRows = await db('category_translations')
    .where({ category_id: base.category_id })
    .select('locale', 'title');
  const catPrimary = pickTranslationRow(
    catRows.map((c) => ({ locale: c.locale, title: c.title, summary: '' })),
    courseLocale
  );

  const otherLocales = rtRows
    .filter((r) => r.locale !== primary.locale)
    .map((r) => ({
      locale: r.locale,
      title: String(r.title || '').trim(),
      summary: String(r.summary || '').trim(),
    }))
    .filter((r) => r.title || r.summary)
    .slice(0, 4);

  return {
    excerpt_language_code: courseLocale,
    excerpt_language_name: String(base.course_language_name || courseLocale).trim(),
    grammar_category_title: String(catPrimary?.title || '').trim(),
    grammar_rule_title: String(primary.title || '').trim(),
    grammar_rule_summary: String(primary.summary || '').trim(),
    other_locale_notes: otherLocales.length ? otherLocales : null,
  };
}

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

      const rule = await loadRuleForAdminAi(ruleId);
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
      const rule = await loadRuleForAdminAi(req.body.rule_id);
      if (!rule) throw new NotFoundError('Rule');

      const summary = await aiService.suggestSummary(rule);
      res.json({ data: { summary } });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

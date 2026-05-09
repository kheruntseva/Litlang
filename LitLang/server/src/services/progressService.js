const db = require('../db/connection');

/**
 * Get all progress entries for a user.
 * @param {string} userId
 * @param {object} filters - { status, language_id }
 * @returns {Promise<Array>}
 */
async function getUserProgress(userId, filters = {}) {
  const user = await db('users').where({ id: userId }).select('preferred_locale').first();
  const locale = user?.preferred_locale === 'ru' ? 'ru' : 'en';

  const query = db('user_progress as up')
    .join('rules as r', 'r.id', 'up.rule_id')
    .join('categories as c', 'c.id', 'r.category_id')
    .join('languages as l', 'l.id', 'c.language_id')
    .leftJoin('rule_translations as rt', function () {
      this.on('rt.rule_id', 'r.id').andOn('rt.locale', db.raw('?', [locale]));
    })
    .where('up.user_id', userId)
    .select(
      'up.id', 'up.rule_id', 'up.status', 'up.updated_at',
      'r.slug as rule_slug',
      'rt.title as rule_title',
      'c.id as category_id',
      'l.id as language_id', 'l.code as language_code'
    );

  if (filters.status) {
    query.where('up.status', filters.status);
  }
  if (filters.language_id) {
    query.where('c.language_id', filters.language_id);
  }

  return query.orderBy('up.updated_at', 'desc');
}

/**
 * Set or update progress for a rule.
 * @param {string} userId
 * @param {number} ruleId
 * @param {string} status - not_started | in_progress | completed
 * @returns {Promise<object>}
 */
async function setProgress(userId, ruleId, status) {
  const [progress] = await db('user_progress')
    .insert({
      user_id: userId,
      rule_id: ruleId,
      status,
      updated_at: db.fn.now(),
    })
    .onConflict(['user_id', 'rule_id'])
    .merge({ status, updated_at: db.fn.now() })
    .returning('*');

  return progress;
}

/**
 * Get learning stats for a user.
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getStats(userId) {
  const user = await db('users').where({ id: userId }).select('preferred_locale').first();
  const locale = user?.preferred_locale === 'ru' ? 'ru' : 'en';

  const statusCounts = await db('user_progress')
    .where('user_id', userId)
    .groupBy('status')
    .select('status')
    .count('* as count');

  const byLanguage = await db('user_progress as up')
    .join('rules as r', 'r.id', 'up.rule_id')
    .join('categories as c', 'c.id', 'r.category_id')
    .join('languages as l', 'l.id', 'c.language_id')
    .where('up.user_id', userId)
    .groupBy('l.id', 'l.code', 'l.name', 'up.status')
    .select('l.id as language_id', 'l.code', 'l.name', 'up.status')
    .count('* as count');

  const categoryProgress = await db('user_progress as up')
    .join('rules as r', 'r.id', 'up.rule_id')
    .join('categories as c', 'c.id', 'r.category_id')
    .join('category_translations as ct', function () {
      this.on('ct.category_id', 'c.id').andOn('ct.locale', db.raw('?', [locale]));
    })
    .where('up.user_id', userId)
    .groupBy('c.id', 'ct.title', 'c.sort_order')
    .select(
      'c.id as category_id',
      'ct.title as category_title',
      db.raw('count(*)::int as total'),
      db.raw("sum((up.status = 'completed')::int)::int as completed"),
      db.raw("sum((up.status = 'in_progress')::int)::int as in_progress")
    )
    .orderBy('c.sort_order', 'asc')
    .orderBy('c.id', 'asc');

  const totalTracked = categoryProgress.reduce((acc, row) => acc + Number(row.total || 0), 0);
  const totalCompleted = categoryProgress.reduce((acc, row) => acc + Number(row.completed || 0), 0);
  const overallPercent = totalTracked > 0 ? Math.round((totalCompleted / totalTracked) * 100) : 0;

  return {
    statusCounts,
    byLanguage,
    categoryProgress,
    overallPercent,
    totalTrackedRules: totalTracked,
  };
}

module.exports = { getUserProgress, setProgress, getStats };

const db = require('../db/connection');

/**
 * Languages ranked by learning activity (user_progress rows).
 * @returns {Promise<Array<{ id: number, name: string, activity_count: number }>>}
 */
async function popularLanguagesByActivity() {
  return db('languages as l')
    .join('categories as c', 'c.language_id', 'l.id')
    .join('rules as r', 'r.category_id', 'c.id')
    .join('user_progress as up', 'up.rule_id', 'r.id')
    .groupBy('l.id', 'l.name')
    .select('l.id', 'l.name')
    .count('up.id as activity_count')
    .orderBy('activity_count', 'desc')
    .limit(10);
}

/**
 * Fallback: rule counts per language when there is no progress data yet.
 * @returns {Promise<Array<{ id: number, name: string, rule_count: number }>>}
 */
async function languagesByRuleCount() {
  return db('languages as l')
    .join('categories as c', 'c.language_id', 'l.id')
    .join('rules as r', 'r.category_id', 'c.id')
    .groupBy('l.id', 'l.name')
    .select('l.id', 'l.name')
    .count('r.id as rule_count')
    .orderBy('rule_count', 'desc')
    .limit(10);
}

/**
 * Completion share per grammar category (all users, English category titles for admin).
 * @returns {Promise<Array<{ category: string, total: number, completed: number }>>}
 */
async function completionRatesByCategory() {
  return db('user_progress as up')
    .join('rules as r', 'r.id', 'up.rule_id')
    .join('categories as cat', 'cat.id', 'r.category_id')
    .join('category_translations as ct', function () {
      this.on('ct.category_id', 'cat.id').andOn('ct.locale', db.raw('?', ['en']));
    })
    .groupBy('cat.id', 'ct.title', 'cat.sort_order')
    .select(
      'ct.title as category',
      db.raw('count(up.id)::int as total'),
      db.raw("sum((up.status = 'completed')::int)::int as completed")
    )
    .orderBy('cat.sort_order', 'asc')
    .orderBy('cat.id', 'asc');
}

/**
 * Get analytics dashboard data.
 * @returns {Promise<object>}
 */
async function getDashboard() {
  const [
    userCount,
    languageCount,
    ruleCount,
    excerptCount,
    statusDistribution,
    popularLanguagesRaw,
    recentRegistrations,
    completionRatesRaw,
  ] = await Promise.all([
    db('users').where('is_active', true).count('* as count').first(),
    db('languages').count('* as count').first(),
    db('rules').count('* as count').first(),
    db('excerpts').count('* as count').first(),
    db('user_progress')
      .select('status')
      .count('* as count')
      .groupBy('status'),
    popularLanguagesByActivity(),
    db('users')
      .where('is_active', true)
      .whereRaw("created_at >= NOW() - INTERVAL '30 days'")
      .count('* as count')
      .first(),
    completionRatesByCategory(),
  ]);

  let popularLanguages = (popularLanguagesRaw || []).map((row) => ({
    id: row.id,
    name: row.name,
    count: parseInt(row.activity_count, 10) || 0,
    metric: 'activity',
  }));

  if (!popularLanguages.length) {
    const byRules = await languagesByRuleCount();
    popularLanguages = byRules.map((row) => ({
      id: row.id,
      name: row.name,
      count: parseInt(row.rule_count, 10) || 0,
      metric: 'rules',
    }));
  }

  const completionRates = (completionRatesRaw || []).map((row) => ({
    category: row.category,
    total: Number(row.total) || 0,
    completed: Number(row.completed) || 0,
  }));

  return {
    totalUsers: parseInt(userCount.count, 10),
    totalLanguages: parseInt(languageCount.count, 10),
    totalRules: parseInt(ruleCount.count, 10),
    totalExcerpts: parseInt(excerptCount.count, 10),
    userProgressByStatus: statusDistribution.map((r) => ({
      status: r.status,
      count: parseInt(r.count, 10),
    })),
    completionByCategory: completionRates,
    popularLanguages,
    recentRegistrations: parseInt(recentRegistrations.count, 10),
  };
}

module.exports = { getDashboard };

/**
 * Apply pagination to a Knex query and return paginated result.
 * @param {import('knex').Knex.QueryBuilder} query - The Knex query builder
 * @param {object} options
 * @param {number} options.page - Current page (1-indexed)
 * @param {number} options.limit - Items per page
 * @returns {Promise<{data: Array, meta: {page: number, limit: number, total: number, totalPages: number}}>}
 */
async function paginate(query, { page = 1, limit = 20 } = {}) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (page - 1) * limit;

  // Clone query for counting
  const countQuery = query.clone().clearSelect().clearOrder().count('* as total').first();
  const [{ total }, data] = await Promise.all([
    countQuery,
    query.limit(limit).offset(offset),
  ]);

  const totalCount = parseInt(total, 10);

  return {
    data,
    meta: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}

module.exports = { paginate };

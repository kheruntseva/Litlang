/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  await knex('rules').del();
  await knex('rules').insert([
    { id: 1, category_id: 1, slug: 'definite-article-the', sort_order: 1 },
    { id: 2, category_id: 1, slug: 'indefinite-articles-a-an', sort_order: 2 },
    { id: 3, category_id: 1, slug: 'zero-article', sort_order: 3 },
  ]);
  await knex.raw("SELECT setval('rules_id_seq', (SELECT MAX(id) FROM rules))");
};

/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  await knex('categories').del();
  await knex('categories').insert([
    { id: 1, language_id: 1, slug: 'articles', sort_order: 1 },
    { id: 2, language_id: 1, slug: 'prepositions', sort_order: 2 },
    { id: 3, language_id: 1, slug: 'tenses', sort_order: 3 },
    { id: 4, language_id: 1, slug: 'conditionals', sort_order: 4 },
  ]);
  await knex.raw("SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))");
};

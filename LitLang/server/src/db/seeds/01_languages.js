/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  await knex('languages').del();
  await knex('languages').insert([
    { id: 1, code: 'en', name: 'English' },
    { id: 2, code: 'es', name: 'Spanish' },
  ]);
  // Reset sequence
  await knex.raw("SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))");
};

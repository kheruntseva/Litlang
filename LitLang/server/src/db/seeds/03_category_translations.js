/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  await knex('category_translations').del();
  await knex('category_translations').insert([
    // Articles
    { category_id: 1, locale: 'en', title: 'Articles' },
    { category_id: 1, locale: 'ru', title: 'Артикли' },
    // Prepositions
    { category_id: 2, locale: 'en', title: 'Prepositions' },
    { category_id: 2, locale: 'ru', title: 'Предлоги' },
    // Tenses
    { category_id: 3, locale: 'en', title: 'Tenses' },
    { category_id: 3, locale: 'ru', title: 'Времена' },
    // Conditionals
    { category_id: 4, locale: 'en', title: 'Conditionals' },
    { category_id: 4, locale: 'ru', title: 'Условные предложения' },
  ]);
};

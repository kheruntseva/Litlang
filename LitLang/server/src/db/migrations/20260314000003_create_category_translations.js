/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.createTable('category_translations', (table) => {
    table.increments('id').primary();
    table.integer('category_id').unsigned().notNullable()
      .references('id').inTable('categories').onDelete('CASCADE');
    table.string('locale', 10).notNullable();
    table.string('title', 200).notNullable();

    table.unique(['category_id', 'locale']);
    table.index('category_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('category_translations');
};

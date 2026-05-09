/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.createTable('categories', (table) => {
    table.increments('id').primary();
    table.integer('language_id').unsigned().notNullable()
      .references('id').inTable('languages').onDelete('CASCADE');
    table.string('slug', 200).notNullable();
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.unique(['language_id', 'slug']);
    table.index('language_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('categories');
};

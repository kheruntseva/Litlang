/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.createTable('books', (table) => {
    table.increments('id').primary();
    table.string('title', 500).notNullable();
    table.string('author', 300).notNullable();
    table.string('isbn', 20).nullable().unique();
    table.integer('language_id').unsigned().nullable()
      .references('id').inTable('languages').onDelete('SET NULL');
    table.string('cover_url', 500).nullable();
    table.integer('gutenberg_id').nullable().unique();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('language_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('books');
};

/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.createTable('gutenberg_texts', (table) => {
    table.increments('id').primary();
    table.integer('book_id').unsigned().notNullable()
      .references('id').inTable('books').onDelete('CASCADE');
    table.text('full_text').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('book_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('gutenberg_texts');
};

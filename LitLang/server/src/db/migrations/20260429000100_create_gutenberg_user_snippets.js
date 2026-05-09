/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.createTable('gutenberg_user_snippets', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('book_id').unsigned().notNullable()
      .references('id').inTable('books').onDelete('CASCADE');
    table.text('passage').notNullable();
    table.integer('paragraph_number').nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.unique(['user_id', 'book_id', 'passage']);
    table.index('user_id');
    table.index('book_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('gutenberg_user_snippets');
};

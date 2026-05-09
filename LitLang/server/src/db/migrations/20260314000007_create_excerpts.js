/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.createTable('excerpts', (table) => {
    table.increments('id').primary();
    table.integer('rule_id').unsigned().notNullable()
      .references('id').inTable('rules').onDelete('CASCADE');
    table.integer('book_id').unsigned().notNullable()
      .references('id').inTable('books').onDelete('CASCADE');
    table.text('passage').notNullable();
    table.text('highlight').nullable();
    table.string('page_number', 20).nullable();
    table.string('chapter', 100).nullable();
    table.text('context_note').nullable();
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('rule_id');
    table.index('book_id');
  }).then(() => {
    // GIN index for full-text search on passage
    return knex.raw(`
      CREATE INDEX excerpts_passage_search_idx
      ON excerpts
      USING GIN (to_tsvector('english', passage))
    `);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('excerpts');
};

/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.createTable('rules', (table) => {
    table.increments('id').primary();
    table.integer('category_id').unsigned().notNullable()
      .references('id').inTable('categories').onDelete('CASCADE');
    table.string('slug', 300).notNullable();
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.unique(['category_id', 'slug']);
    table.index('category_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('rules');
};
